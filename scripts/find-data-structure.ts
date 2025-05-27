import chalk from 'chalk';
import { getDbo } from '../db.js';

/**
 * Script to search for any documents with Data structure in B arrays
 */
async function findDataStructure() {
  console.log(chalk.blue('Searching for Data structure in all collections...'));

  const db = await getDbo();
  const allCollections = await db.listCollections().toArray();

  for (const collInfo of allCollections) {
    const collectionName = collInfo.name;
    console.log(chalk.yellow(`\nSearching collection: ${collectionName}`));

    try {
      const collection = db.collection(collectionName);

      // Search for any document with B.Data
      const withData = await collection
        .find({
          B: {
            $elemMatch: {
              Data: { $exists: true },
            },
          },
        })
        .limit(5)
        .toArray();

      if (withData.length > 0) {
        console.log(chalk.red(`Found ${withData.length} documents with B.Data structure:`));
        for (const doc of withData) {
          console.log(`  ID: ${doc._id}`);
          console.log('  B structure:', JSON.stringify(doc.B, null, 2));
        }
      } else {
        console.log(chalk.green('No Data structure found'));
      }
    } catch (error) {
      console.error(chalk.red(`Error searching collection ${collectionName}:`), error);
    }
  }

  console.log(chalk.green('\nSearch complete!'));
  process.exit(0);
}

// Run the search
findDataStructure().catch((error) => {
  console.error(chalk.red('Search failed:'), error);
  process.exit(1);
});
