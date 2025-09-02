const express = require('express');
const Data = require('../models/Data');

const router = express.Router();

// --- Get user data ---
// GET /api/data
router.get('/', async (req, res) => {
  try {
    const dataDoc = await Data.findOne({ userId: req.user.userId });
    if (!dataDoc) {
      // This case might happen if a user was created but their data doc wasn't.
      // We create it on the fly to prevent errors.
      const newData = new Data({ userId: req.user.userId, appData: {} });
      await newData.save();
      return res.json({});
    }
    res.json(dataDoc.appData);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ message: 'Error al obtener los datos.' });
  }
});

// --- Save/update user data ---
// POST /api/data
router.post('/', async (req, res) => {
  try {
    const appData = req.body;
    
    // Use `findOneAndUpdate` with `upsert: true` to either update the existing document
    // or create a new one if it doesn't exist. This is a robust way to handle data saving.
    await Data.findOneAndUpdate(
      { userId: req.user.userId },
      { $set: { appData: appData } },
      { upsert: true, new: true }
    );
    
    res.status(204).send(); // 204 No Content is appropriate for a save operation that doesn't return data
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ message: 'Error al guardar los datos.' });
  }
});

module.exports = router;
