const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Data = require('../models/Data');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// --- Register a new user ---
// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña son requeridos.' });
  }

  try {
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'El nombre de usuario ya existe.' });
    }

    const newUser = new User({ username, password });
    await newUser.save();

    // Create an empty data document for the new user with onboarding flag
    const initialSettings = {
        nif: '', 
        fullName: '', 
        address: '',
        defaultVatRate: 21, 
        defaultIrpfRate: 15, 
        monthlyAutonomoFee: 80,
        geminiApiKey: '',
        isInRecargoEquivalencia: false,
        applySevenPercentDeduction: false,
        rentsOffice: false,
        isInROI: false,
        hiresProfessionals: false,
        professionalModeEnabled: true,
        defaultPrivacyMode: false,
        initialBalances: {},
        hasCompletedOnboarding: false,
    };
    
    const initialData = {
        settings: initialSettings,
        incomes: [], expenses: [], personalMovements: [], transfers: [],
        investmentGoods: [],
        savingsGoals: [], potentialIncomes: [], potentialExpenses: [],
        professionalCategories: [], // Let onboarding set defaults
        personalCategories: [],
    };

    const newData = new Data({ userId: newUser._id, appData: initialData });
    await newData.save();

    const payload = { userId: newUser._id, username: newUser.username };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: { id: newUser._id, username: newUser.username },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Error del servidor al registrar el usuario.' });
  }
});

// --- Login a user ---
// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña son requeridos.' });
  }

  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const payload = { userId: user._id, username: user.username };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: { id: user._id, username: user.username },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error del servidor al iniciar sesión.' });
  }
});

// --- Get current user (token validation) ---
// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // req.user is attached by the authMiddleware
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    res.json({ id: user._id, username: user.username });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ message: 'Error del servidor.' });
  }
});


module.exports = router;