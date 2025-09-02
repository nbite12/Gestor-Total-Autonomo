const mongoose = require('mongoose');
const { Schema } = mongoose;

// This schema is designed to be very flexible to store the entire app state.
// We are defining the structure loosely here, allowing any object structure.
// The frontend is the source of truth for the AppData structure.

const DataSchema = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  // We use Mixed type to allow for a flexible, schema-less object.
  // This is perfect for storing the entire AppData state from the frontend.
  appData: {
    type: Schema.Types.Mixed,
    required: true,
  },
}, { timestamps: true, minimize: false });

module.exports = mongoose.model('Data', DataSchema);
