import chalk from 'chalk';
import { getDbo } from '../db.js';

/**
 * Script to check the actual structure of B arrays in the database
 */
async function checkBStructure() {
  console.log(chalk.blue('Checking B array structure in database...'));

  const db = await getDbo();
  const collections = ['message', 'like', 'post', 'repost', 'c', 'u'];

  for (const collectionName of collections) {
    console.log(chalk.yellow(`\nChecking collection: ${collectionName}`));

    try {
      const collection = db.collection(collectionName);

      // Find a few sample documents with B arrays
      const samples = await collection
        .find({
          B: { $exists: true, $ne: [] },
        })
        .limit(3)
        .toArray();

      console.log(`Found ${samples.length} documents with B arrays`);

      for (let i = 0; i < samples.length; i++) {
        console.log(chalk.cyan(`\nSample ${i + 1}:`));
        console.log('Document ID:', samples[i]._id);
        console.log('B structure:', JSON.stringify(samples[i].B, null, 2));

        // Check for different patterns
        if (samples[i].B && Array.isArray(samples[i].B)) {
          for (let j = 0; j < samples[i].B.length; j++) {
            const b = samples[i].B[j];
            console.log(`  B[${j}]:`, Object.keys(b || {}));
            if (b.Data) {
              console.log(chalk.red('    Has Data field with keys:', Object.keys(b.Data)));
            }
            if (b.content) {
              console.log(chalk.green('    Has content field:', typeof b.content));
            }
          }
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error checking collection ${collectionName}:`), error);
    }
  }

  console.log(chalk.green('\nStructure check complete!'));
  process.exit(0);
}

// Run the check
checkBStructure().catch((error) => {
  console.error(chalk.red('Check failed:'), error);
  process.exit(1);
});
