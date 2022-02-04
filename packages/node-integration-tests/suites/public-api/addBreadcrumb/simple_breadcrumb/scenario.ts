import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: 'https://public@dsn.ingest.sentry.io/1337',
  release: '1.0',
});

Sentry.addBreadcrumb({
  category: 'foo',
  message: 'bar',
  level: 'critical' as Sentry.Severity,
});

Sentry.captureMessage('test_simple');
