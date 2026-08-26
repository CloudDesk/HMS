import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/hms-test');
  
  const TestModel = mongoose.model('TestLock', new mongoose.Schema({ name: String }));
  await TestModel.deleteMany({});
  const doc = await TestModel.create({ name: 'shared' });
  
  const CounterModel = mongoose.model('TestCounter', new mongoose.Schema({ val: Number }));
  await CounterModel.deleteMany({});

  let aborted = 0;

  const startTransaction = async (i) => {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        console.log(`[${i}] Started transaction`);
        
        // Acquire lock
        await TestModel.updateOne({ _id: doc._id }, { $inc: { __v: 0 } }, { session });
        console.log(`[${i}] Acquired lock`);
        
        // Wait a bit to simulate work
        await new Promise(r => setTimeout(r, 50));
        
        const count = await CounterModel.countDocuments({}).session(session);
        console.log(`[${i}] Count is ${count}`);
        
        await CounterModel.create([{ val: i }], { session });
        console.log(`[${i}] Inserted ${i}`);
      });
    } catch (err) {
      console.log(`[${i}] Error:`, err.message);
      aborted++;
    } finally {
      await session.endSession();
    }
  };

  await Promise.all([
    startTransaction(1),
    startTransaction(2),
    startTransaction(3),
    startTransaction(4),
    startTransaction(5)
  ]);

  const finalCount = await CounterModel.countDocuments();
  console.log(`Final count: ${finalCount}`);
  console.log(`Aborted: ${aborted}`);
  
  await mongoose.disconnect();
}

run().catch(console.error);
