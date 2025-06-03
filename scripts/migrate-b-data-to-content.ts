import chalk from 'chalk';
import { getDbo } from '../db.js';

/**
 * Migration script to convert B.Data.utf8/base64 to B.content
 * This ensures consistency across the entire database
 */
async function migrateBDataToContent() {
  console.log(chalk.blue('Starting migration: B.Data -> B.content'));

  const db = await getDbo();
  const collections = ['message', 'like', 'post', 'repost', 'c', 'u'];

  let totalUpdated = 0;

  for (const collectionName of collections) {
    console.log(chalk.yellow(`\nProcessing collection: ${collectionName}`));

    try {
      const collection = db.collection(collectionName);

      // Find all documents with B.Data structure
      const documentsWithData = await collection
        .find({
          'B.Data': { $exists: true },
        })
        .toArray();

      console.log(`Found ${documentsWithData.length} documents with B.Data structure`);

      let collectionUpdated = 0;

      for (const doc of documentsWithData) {
        if (doc.B && Array.isArray(doc.B)) {
          const updatedB = doc.B.map((b: Record<string, unknown>) => {
            if (b.Data && typeof b.Data === 'object' && b.Data !== null) {
              const data = b.Data as Record<string, unknown>;
              // Convert Data structure to content
              const content = (data.utf8 as string) || (data.base64 as string) || '';
              const encoding = data.utf8 ? 'utf-8' : data.base64 ? 'base64' : '';

              return {
                encoding: b.encoding || encoding,
                content: b.content || content,
                'content-type': b['content-type'] || 'text/plain',
                // Remove Data field
              };
            }
            return b;
          });

          // Update the document
          await collection.updateOne({ _id: doc._id }, { $set: { B: updatedB } });

          collectionUpdated++;

          if (collectionUpdated % 100 === 0) {
            console.log(`Updated ${collectionUpdated} documents...`);
          }
        }
      }

      console.log(chalk.green(`✓ Updated ${collectionUpdated} documents in ${collectionName}`));
      totalUpdated += collectionUpdated;
    } catch (error) {
      console.error(chalk.red(`Error processing collection ${collectionName}:`), error);
    }
  }

  console.log(chalk.green(`\n✓ Migration complete! Total documents updated: ${totalUpdated}`));
  process.exit(0);
}

// Run the migration
migrateBDataToContent().catch((error) => {
  console.error(chalk.red('Migration failed:'), error);
  process.exit(1);
});
