import mongoose from 'mongoose';
import app from '../src/index';

function build() {
  beforeAll(async () => {
    console.log('Start Test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
    app.close();
  });

  return app;
}

export { build };
