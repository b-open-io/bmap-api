import type { ChartConfiguration } from 'chart.js'
import QuickChart from 'quickchart-js'
const getGradientFillHelper = QuickChart.getGradientFillHelper

import { getDbo } from './db.js'
import { Timeframe } from './types.js'

export type TimeSeriesData = {
  _id: number // Block height
  count: number
}[]

export type ChartData = {
  config: ChartConfiguration;
  width: number;
  height: number;
}

const generateChart = (
  timeSeriesData: TimeSeriesData,
  globalChart: boolean
): QuickChart => {
  const width = 1280 / (globalChart ? 1 : 4)
  const height = 300 / (globalChart ? 1 : 4)

  const labels = timeSeriesData.map((d) => d._id)
  const dataValues = timeSeriesData.map((d) => d.count)

  const chartConfig: ChartConfiguration = {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          data: dataValues,
          fill: true,
          borderColor: 'rgba(213, 99, 255, 0.5)',
          borderWidth: 3,
          pointBackgroundColor: 'rgba(255, 99, 255, 0.5)',
          pointRadius: 3,
          tension: 0.4,
          backgroundColor: getGradientFillHelper('vertical', [
            'rgba(255, 99, 255, 1)',
            'rgba(255, 99, 255, 0)',
          ]),
        },
      ],
    },
    options: {
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: globalChart
        ? {
            x: {
              title: { display: true, text: 'Block Height', color: '#333' },
              grid: { color: '#111' },
              ticks: { color: '#fff' },
            },
            y: {
              title: { display: true, text: 'Count', color: '#333' },
              grid: { color: '#111' },
              ticks: { color: '#fff' },
            },
          }
        : {
            x: { display: false },
            y: { display: false },
          },
    },
  }

  const qc = new QuickChart()
  qc.setConfig(chartConfig)
  qc.setBackgroundColor('transparent')
  qc.setWidth(width)
  qc.setHeight(height)

  return qc
}

const generateTotalsChart = async (
  collectionName: string,
  startBlock: number,
  endBlock: number,
  blockRange = 10
) => {
  const timeSeriesData = await getTimeSeriesData(
    collectionName,
    startBlock,
    endBlock,
    blockRange
  )
  const chart = generateChart(timeSeriesData, false)
  return {
    chart,
    chartData: {
      config: (chart as any)._config,
      width: 1280 / 4,
      height: 300 / 4
    }
  }
}

const generateCollectionChart = async (
  collectionName: string | undefined,
  startBlock: number,
  endBlock: number,
  range: number
) => {
  const dbo = await getDbo()
  const allCollections = await dbo.listCollections().toArray()
  const allDataPromises = allCollections.map((c) =>
    getTimeSeriesData(c.name, startBlock, endBlock, range)
  )
  const allTimeSeriesData = await Promise.all(allDataPromises)

  const globalData: Record<number, number> = {}
  for (const collectionData of allTimeSeriesData) {
    for (const { _id, count } of collectionData) {
      globalData[_id] = (globalData[_id] || 0) + count
    }
  }

  const aggregatedData = Object.keys(globalData).map((blockHeight) => ({
    _id: Number(blockHeight),
    count: globalData[blockHeight],
  }))

  const chart = generateChart(aggregatedData, true)
  return {
    chart,
    chartData: {
      config: (chart as any)._config,
      width: 1280,
      height: 300
    }
  }
}

async function getTimeSeriesData(
  collectionName: string,
  startBlock: number,
  endBlock: number,
  blockRange = 10
): Promise<TimeSeriesData> {
  const dbo = await getDbo()
  
  try {
    // First check if collection exists and has any documents
    const count = await dbo.collection(collectionName).countDocuments({
      'blk.i': { $gte: startBlock, $lte: endBlock }
    });

    if (count === 0) {
      console.log(`No data found for ${collectionName} between blocks ${startBlock}-${endBlock}`);
      return [];
    }

    const pipeline = [
      {
        $match: {
          'blk.i': {
            $gte: startBlock,
            $lte: endBlock,
          },
        },
      },
      {
        $project: {
          blockGroup: {
            $subtract: ['$blk.i', { $mod: ['$blk.i', blockRange] }],
          },
        },
      },
      {
        $group: {
          _id: '$blockGroup',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]

    const result = await dbo.collection(collectionName).aggregate(pipeline).toArray()
    console.log(`Found ${result.length} data points for ${collectionName}`);
    return result as TimeSeriesData;
  } catch (error) {
    console.error(`Error getting time series data for ${collectionName}:`, error);
    return [];
  }
}

function timeframeToBlocks(period: string) {
  switch (period) {
    case Timeframe.Day:
      return 144
    case Timeframe.Week:
      return 1008
    case Timeframe.Month:
      return 4320
    case Timeframe.Year:
      return 52560
    case Timeframe.All:
      return 0
    default:
      return 0
  }
}

function getBlocksRange(
  currentBlockHeight: number,
  timeframe: string
): [number, number] {
  const blocks = timeframeToBlocks(timeframe)
  const startBlock = currentBlockHeight - blocks
  const endBlock = currentBlockHeight
  return [startBlock, endBlock]
}

export {
  generateChart,
  generateCollectionChart,
  generateTotalsChart,
  getBlocksRange,
  getTimeSeriesData,
}
