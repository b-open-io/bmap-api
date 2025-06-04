import { Elysia, t } from 'elysia';
import { getBlockHeightFromCache } from '../cache.js';
import { getBlocksRange, getTimeSeriesData } from '../chart.js';
import { CHART_ROUTES } from '../constants/routes.js';
import { getDbo } from '../db.js';
import { Timeframe } from '../types.js';

// Import shared schemas - but chart schemas are unique enough to keep local
// (They don't overlap with other domains)

const ChartParams = t.Object({
  name: t.Optional(t.String({ description: 'Collection name to get chart data for' })),
});

const ChartQuery = t.Object({
  timeframe: t.Optional(t.String({ description: 'Time range for the chart data' })),
});

const ChartResponse = t.Object({
  labels: t.Array(t.Number()),
  values: t.Array(t.Number()),
  range: t.Array(t.Number()),
});

export const chartRoutes = new Elysia().get(
  CHART_ROUTES.CHART_DATA,
  async ({ params, query }) => {
    console.log('Starting chart-data request');
    try {
      const timeframe = (query.timeframe as string) || Timeframe.Day;
      const collectionName = params.name;
      console.log('Chart data request for:', { collectionName, timeframe });

      const currentBlockHeight = await getBlockHeightFromCache();
      const [startBlock, endBlock] = getBlocksRange(currentBlockHeight, timeframe);
      console.log('Block range:', startBlock, '-', endBlock);

      let range = 1;
      switch (timeframe) {
        case Timeframe.Day:
          range = 1;
          break;
        case Timeframe.Week:
          range = 7;
          break;
        case Timeframe.Month:
          range = 30;
          break;
        case Timeframe.Year:
          range = 365;
          break;
      }

      if (!collectionName) {
        const dbo = await getDbo();
        const allCollections = await dbo.listCollections().toArray();
        const allDataPromises = allCollections.map((c) =>
          getTimeSeriesData(c.name, startBlock, endBlock, range)
        );
        const allTimeSeriesData = await Promise.all(allDataPromises);

        const globalData: Record<number, number> = {};
        for (const collectionData of allTimeSeriesData) {
          for (const { _id, count } of collectionData) {
            globalData[_id] = (globalData[_id] || 0) + count;
          }
        }

        const aggregatedData = Object.keys(globalData).map((blockHeight) => ({
          _id: Number(blockHeight),
          count: globalData[blockHeight],
        }));

        return {
          labels: aggregatedData.map((d) => d._id),
          values: aggregatedData.map((d) => d.count),
          range: [startBlock, endBlock],
        };
      }

      const timeSeriesData = await getTimeSeriesData(collectionName, startBlock, endBlock, range);
      return {
        labels: timeSeriesData.map((d) => d._id),
        values: timeSeriesData.map((d) => d.count),
        range: [startBlock, endBlock],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate chart data: ${message}`);
    }
  },
  {
    params: ChartParams,
    query: ChartQuery,
    response: ChartResponse,
    detail: {
      tags: ['charts'],
      description: 'Get time series data for charts',
      summary: 'Chart data',
      parameters: [
        {
          name: 'name',
          in: 'path',
          required: false,
          schema: {
            type: 'string',
          },
          description: 'Collection name to get chart data for',
        },
        {
          name: 'timeframe',
          in: 'query',
          required: false,
          schema: {
            type: 'string',
            enum: Object.values(Timeframe),
          },
          description: 'Time range for the chart data',
        },
      ],
      responses: {
        200: {
          description: 'Chart data points',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    t: { type: 'number', description: 'Timestamp' },
                    y: { type: 'number', description: 'Value' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }
);
