import bmapjs from 'bmapjs';
import { parse } from 'bpu-ts';
import chalk from 'chalk';

const { allProtocols, TransformTx } = bmapjs;

/**
 * Test script to see what format bmapjs returns for B arrays
 */
async function testTransactionFormat() {
  console.log(chalk.blue('Testing bmapjs transaction format...'));
  
  // Sample raw transaction hex (this would come from a real transaction)
  // For testing, let's use a simple transaction format
  const sampleRawTx = "01000000012345678901234567890123456789012345678901234567890123456789012345010000006a473044022012345678901234567890123456789012345678901234567890123456789012340220123456789012345678901234567890123456789012345678901234567890123401210123456789012345678901234567890123456789012345678901234567890123ffffffff0100000000000000001976a914123456789012345678901234567890123456789088ac00000000";
  
  try {
    console.log('Parsing with bpu-ts...');
    const bob = await parse({
      tx: { r: sampleRawTx },
      split: [{ token: { op: 106 }, include: 'l' }, { token: { s: '|' } }],
    });

    if (!bob) {
      console.log('No result from bpu-ts parse');
      return;
    }

    console.log('BOB result:', JSON.stringify(bob, null, 2));

    console.log('\nTransforming with bmapjs...');
    const tx = await TransformTx(
      bob as any,
      allProtocols.map((p) => p.name)
    );

    if (tx && tx.B) {
      console.log(chalk.yellow('B array from bmapjs:'));
      console.log(JSON.stringify(tx.B, null, 2));
      
      // Check the structure
      tx.B.forEach((b: any, index: number) => {
        console.log(`\nB[${index}] keys:`, Object.keys(b || {}));
        if (b.Data) {
          console.log(chalk.red(`  Has Data field:`, b.Data));
        }
        if (b.content) {
          console.log(chalk.green(`  Has content field:`, b.content));
        }
      });
    } else {
      console.log('No B array in transformed result');
    }

  } catch (error) {
    console.error(chalk.red('Error testing transaction format:'), error);
  }
  
  process.exit(0);
}

testTransactionFormat();