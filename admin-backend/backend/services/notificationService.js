// 📁 backend/services/notificationService.js
const PushAlert = require('../models/PushAlert');

async function createPushAlert(title, message) {
  const alert = new PushAlert({ title, message });
  return await alert.save();
}

async function getAlertHistory() {
  return await PushAlert.find().sort({ createdAt: -1 });
}

module.exports = { createPushAlert, getAlertHistory };
