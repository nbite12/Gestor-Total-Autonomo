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

    // --- Data Migration ---
    const appData = dataDoc.appData || {};
    let needsSave = false;

    // Expenses need `isPaid` and `paymentDate`
    if (appData.expenses && Array.isArray(appData.expenses)) {
      for (const expense of appData.expenses) {
        if (typeof expense.isPaid === 'undefined') {
          expense.isPaid = true; // Assume old expenses are paid
          expense.paymentDate = expense.date;
          needsSave = true;
        }
      }
    }
    // Incomes just need `paymentDate` if paid and missing
    if (appData.incomes && Array.isArray(appData.incomes)) {
        for (const income of appData.incomes) {
            if (income.isPaid && typeof income.paymentDate === 'undefined') {
                income.paymentDate = income.date;
                needsSave = true;
            }
        }
    }
    
    // PersonalMovements need `isPaid` and `paymentDate`
    if (appData.personalMovements && Array.isArray(appData.personalMovements)) {
        for (const movement of appData.personalMovements) {
            if (typeof movement.isPaid === 'undefined') {
                movement.isPaid = true;
                movement.paymentDate = movement.date;
                needsSave = true;
            }
        }
    }


    if (needsSave) {
        dataDoc.markModified('appData'); // Important for Mixed types in Mongoose
        await dataDoc.save();
    }
    // --- End Migration ---
    
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