const ThreatLog = require('../models/ThreatLog');

const CRITICAL_REPUTATION_SCORE = 60;
const AUTO_LOCK_IF_VIRUS_REPORTED = true;

const threatEvaluator = async (scanResult) => {
  try {
    const {
      xssDetected,
      credentialsLeaked,
      ipReputationScore,
      proxyDetected,
      virusReported,
      lastScan,
      origin = 'auto'
    } = scanResult;

    await ThreatLog.create({
      xssDetected,
      credentialsLeaked,
      ipReputationScore,
      proxyDetected,
      virusReported,
      lastScan,
      origin
    });

    const isCriticalReputation = ipReputationScore < CRITICAL_REPUTATION_SCORE;
    const shouldLockdown = isCriticalReputation || (AUTO_LOCK_IF_VIRUS_REPORTED && virusReported);

    if (shouldLockdown) {
      console.warn('⚠️ Auto-Flag Triggered: Lockdown recommended based on scan result.');
      return {
        flagged: true,
        reason: isCriticalReputation ? 'Low Reputation Score' : 'Virus Reported'
      };
    }

    return { flagged: false };

  } catch (e) {
    console.error('❌ threatEvaluator failed:', e.message);
    return { flagged: false, reason: null };
  }
};

module.exports = threatEvaluator;
