// MongoDB Playground
// To use this playground in VSCode:
// 1. Connect to your MongoDB instance in VSCode
// 2. Select the database in the MongoDB extension sidebar
// 3. Run this playground

// Select the database to use
use('bmap');

// Search for transaction by txid in friend collection
// db.getCollection('friend').find({
//   'tx.h': 'b4053b28ace8611ebeefb9622c4318bd29681bd0bcfd60d081cb05ce93fd2400'
// });

db.getCollection('message').find({
  'tx.h': '7e15211db9eafc0f7506ee6a3c3dcdebe6191a7ec26170aeffa199a39be877f4',
});

// Also try searching by _id if not found
// db.getCollection('friend').find({
//   '_id': 'b4053b28ace8611ebeefb9622c4318bd29681bd0bcfd60d081cb05ce93fd2400'
// });

// // To get more details, use findOne instead of find
// db.getCollection('friend').findOne({
//   'tx.h': 'b4053b28ace8611ebeefb9622c4318bd29681bd0bcfd60d081cb05ce93fd2400'
// });
