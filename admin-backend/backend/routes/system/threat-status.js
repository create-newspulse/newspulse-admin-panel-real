// ✅ File: backend/routes/system/threat-status.js

const express = require('express');
const router = express.Router();
require('dotenv').config();

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

let threatEvaluator = async () => ({ flagged: false, reason: null });
let autoHealer = async () => {};

try {
  threatEvaluator = require('../../middleware/threatEvaluator');
} catch (e) {
  console.warn('⚠️ threatEvaluator not loaded:', e.message);
}
try {
  autoHealer = require('../../middleware/autoHealer');
} catch (e) {
  console.warn('⚠️ autoHealer not loaded:', e.message);
}

const ABUSE_IPDB_KEY = process.env.ABUSE_IPDB_KEY || null;
const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY || null;
const IPQS_API_KEY = process.env.IPQS_API_KEY || null;
const SERVER_IP = '8.8.8.8'; // Replace with real IP

async function fetchWithTimeout(resource, options = {}, timeout = 1500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

router.get('/', async (req, res) => {
  try {
    let abuseScore = 0, fraudScore = 0, vtScore = 0;
    let proxyDetected = false, botDetected = false, ipqsSkipped = false;

    const requests = [
      ABUSE_IPDB_KEY ? fetchWithTimeout(
        `https://api.abuseipdb.com/api/v2/check?ipAddress=${SERVER_IP}&maxAgeInDays=90`,
        { headers: { Key: ABUSE_IPDB_KEY, Accept: 'application/json' } }
      ).then(r => r.json()).then(abuseData => {
        abuseScore = abuseData?.data?.abuseConfidenceScore || 0;
      }).catch(e => {
        console.warn('⚠️ AbuseIPDB error:', e.message);
      }) : Promise.resolve(),

      VIRUSTOTAL_API_KEY ? fetchWithTimeout(
        `https://www.virustotal.com/api/v3/ip_addresses/${SERVER_IP}`,
        { headers: { 'x-apikey': VIRUSTOTAL_API_KEY } }
      ).then(r => r.json()).then(vtData => {
        vtScore = vtData?.data?.attributes?.last_analysis_stats?.malicious || 0;
      }).catch(e => {
        console.warn('⚠️ VirusTotal error:', e.message);
      }) : Promise.resolve(),

      IPQS_API_KEY ? fetchWithTimeout(
        `https://ipqualityscore.com/api/json/ip/${IPQS_API_KEY}/${SERVER_IP}`
      ).then(r => r.json()).then(ipqsData => {
        if (ipqsData.success === false && ipqsData.message?.includes("request quota")) {
          console.warn("⚠️ IPQS skipped: quota limit reached");
          ipqsSkipped = true;
        } else if (ipqsData.success !== false) {
          proxyDetected = ipqsData?.proxy || false;
          botDetected = ipqsData?.bot_status || false;
          fraudScore = ipqsData?.fraud_score || 0;
        } else {
          console.warn("⚠️ IPQS unexpected failure:", ipqsData.message);
        }
      }).catch(e => {
        console.warn('⚠️ IPQS fetch failed:', e.message);
        ipqsSkipped = true;
      }) : Promise.resolve()
    ];

    await Promise.allSettled(requests);

    const result = {
      xssDetected: false,
      credentialsLeaked: !!botDetected,
      ipReputationScore: Math.max(0, 100 - Math.max(abuseScore, fraudScore, vtScore)),
      proxyDetected,
      virusReported: vtScore > 0,
      lastScan: new Date().toISOString(),
      origin: 'manual',
      ipqsSkipped,
    };

    let evaluation = { flagged: false, reason: null };
    try {
      evaluation = await threatEvaluator(result);
    } catch (e) {
      console.warn('⚠️ threatEvaluator failed:', e.message);
    }

    try {
      await autoHealer(result);
    } catch (e) {
      console.warn('⚠️ autoHealer failed:', e.message);
    }

    return res.json({
      success: true,
      ...result,
      flagged: evaluation.flagged,
      reason: evaluation.reason || null,
    });

  } catch (err) {
    console.error('❌ Threat Status API Error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || String(err),
      details: 'Threat status check failed.',
      lastScan: new Date().toISOString(),
    });
  }
});

module.exports = router;
