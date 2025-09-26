import api from './api';

export const logVisit = () =>
  api.post('/analytics/log-event', {
    eventType: 'visit',
    userAgent: navigator.userAgent,
    ip: '', // leave empty if not tracking IP
  });

export const logClick = (articleId: string) =>
  api.post('/analytics/log-event', {
    eventType: 'click',
    articleId,
    userAgent: navigator.userAgent,
    ip: '',
  });

export const getAnalyticsSummary = () =>
  api.get('/analytics/summary');
