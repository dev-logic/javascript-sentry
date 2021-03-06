import { Event, Integration } from '@sentry/types';

import { CaptureConsole } from '../src/captureconsole';

const mockScope = {
  setLevel: jest.fn(),
  setExtra: jest.fn(),
  addEventProcessor: jest.fn(),
};

const mockHub = {
  withScope: jest.fn(callback => {
    callback(mockScope);
  }),
  captureMessage: jest.fn(),
  captureException: jest.fn(),
};

const getMockHubWithIntegration = (integration: Integration) => ({
  ...mockHub,
  getIntegration: jest.fn(() => integration),
});

// We're using this to un-monkey patch the console after each test.
const originalConsole = Object.assign({}, global.console);

describe('CaptureConsole setup', () => {
  afterEach(() => {
    jest.clearAllMocks();

    // Un-monkey-patch the console functions
    Object.assign(global.console, originalConsole);
  });

  it('should patch user-configured console levels', () => {
    const captureConsoleIntegration = new CaptureConsole({ levels: ['log', 'warn'] });
    captureConsoleIntegration.setupOnce(
      () => undefined,
      () => getMockHubWithIntegration(captureConsoleIntegration) as any,
    );

    expect(global.console.error).toBe(originalConsole.error); // not monkey patched
    expect(global.console.log).not.toBe(originalConsole.log); // monkey patched
    expect(global.console.warn).not.toBe(originalConsole.warn); // monkey patched
  });

  it('should fall back to default console levels if none are provided', () => {
    const captureConsoleIntegration = new CaptureConsole();
    captureConsoleIntegration.setupOnce(
      () => undefined,
      () => getMockHubWithIntegration(captureConsoleIntegration) as any,
    );

    // expect a set of defined console levels to have been monkey patched
    expect(global.console.debug).not.toBe(originalConsole.debug);
    expect(global.console.info).not.toBe(originalConsole.info);
    expect(global.console.warn).not.toBe(originalConsole.warn);
    expect(global.console.error).not.toBe(originalConsole.error);
    expect(global.console.log).not.toBe(originalConsole.log);
    expect(global.console.assert).not.toBe(originalConsole.assert);

    // any other fields should not have been patched
    expect(global.console.trace).toBe(originalConsole.trace);
    expect(global.console.table).toBe(originalConsole.table);
  });

  it('should not wrap any functions with an empty levels option', () => {
    const captureConsoleIntegration = new CaptureConsole({ levels: [] });
    captureConsoleIntegration.setupOnce(
      () => undefined,
      () => getMockHubWithIntegration(captureConsoleIntegration) as any,
    );

    // expect the default set of console levels not to have been monkey patched
    expect(global.console.debug).toBe(originalConsole.debug);
    expect(global.console.info).toBe(originalConsole.info);
    expect(global.console.warn).toBe(originalConsole.warn);
    expect(global.console.error).toBe(originalConsole.error);
    expect(global.console.log).toBe(originalConsole.log);
    expect(global.console.assert).toBe(originalConsole.assert);

    // expect no message to be captured with console.log
    global.console.log('some message');
    expect(mockHub.captureMessage).not.toHaveBeenCalled();
  });

  it('setup should fail gracefully when console is not available', () => {
    const consoleRef = global.console;
    // remove console
    delete global.console;

    expect(() => {
      const captureConsoleIntegration = new CaptureConsole();
      captureConsoleIntegration.setupOnce(
        () => undefined,
        () => getMockHubWithIntegration(captureConsoleIntegration) as any,
      );
    }).not.toThrow();

    // reinstate initial console
    global.console = consoleRef;
  });

  it('should set a level in the scope when console function is called', () => {
    const captureConsoleIntegration = new CaptureConsole({ levels: ['error'] });
    captureConsoleIntegration.setupOnce(
      () => undefined,
      () => getMockHubWithIntegration(captureConsoleIntegration) as any,
    );

    // call a wrapped function
    global.console.error('some logging message');

    expect(mockScope.setLevel).toHaveBeenCalledTimes(1);
    expect(mockScope.setLevel).toHaveBeenCalledWith('error');
  });

  it('should send arguments as extra data on failed assertion', () => {
    const captureConsoleIntegration = new CaptureConsole({ levels: ['log'] });
    captureConsoleIntegration.setupOnce(
      () => undefined,
      () => getMockHubWithIntegration(captureConsoleIntegration) as any,
    );

    // call a wrapped function
    global.console.log('some arg 1', 'some arg 2');
    global.console.log();

    expect(mockScope.setExtra).toHaveBeenCalledTimes(2);
    expect(mockScope.setExtra).toHaveBeenCalledWith('arguments', ['some arg 1', 'some arg 2']);
    expect(mockScope.setExtra).toHaveBeenCalledWith('arguments', []);
  });

  it('should add an event processor that sets the `logger` field of events', () => {
    const captureConsoleIntegration = new CaptureConsole({ levels: ['log'] });
    captureConsoleIntegration.setupOnce(
      () => undefined,
      () => getMockHubWithIntegration(captureConsoleIntegration) as any,
    );

    // call a wrapped function
    global.console.log('some message');

    expect(mockScope.addEventProcessor).toHaveBeenCalledTimes(1);

    const addedEventProcessor = mockScope.addEventProcessor.mock.calls[0][0];
    const someEvent: Event = {};
    addedEventProcessor(someEvent);

    expect(someEvent.logger).toBe('console');
  });

  it('should capture message on a failed assertion', () => {
    const captureConsoleIntegration = new CaptureConsole({ levels: ['assert'] });
    captureConsoleIntegration.setupOnce(
      () => undefined,
      () => getMockHubWithIntegration(captureConsoleIntegration) as any,
    );

    global.console.assert(1 + 1 === 3);

    expect(mockScope.setExtra).toHaveBeenLastCalledWith('arguments', []);
    expect(mockHub.captureMessage).toHaveBeenCalledTimes(1);
    expect(mockHub.captureMessage).toHaveBeenCalledWith('Assertion failed: console.assert');
  });

  it('should capture correct message on a failed assertion with message', () => {
    const captureConsoleIntegration = new CaptureConsole({ levels: ['assert'] });
    captureConsoleIntegration.setupOnce(
      () => undefined,
      () => getMockHubWithIntegration(captureConsoleIntegration) as any,
    );

    global.console.assert(1 + 1 === 3, 'expression is false');

    expect(mockScope.setExtra).toHaveBeenLastCalledWith('arguments', ['expression is false']);
    expect(mockHub.captureMessage).toHaveBeenCalledTimes(1);
    expect(mockHub.captureMessage).toHaveBeenCalledWith('Assertion failed: expression is false');
  });

  it('should not capture message on a successful assertion', () => {
    const captureConsoleIntegration = new CaptureConsole({ levels: ['assert'] });
    captureConsoleIntegration.setupOnce(
      () => undefined,
      () => getMockHubWithIntegration(captureConsoleIntegration) as any,
    );

    global.console.assert(1 + 1 === 2);
  });

  it('should capture exception when console logs an error object with level set to "error"', () => {
    const captureConsoleIntegration = new CaptureConsole({ levels: ['error'] });
    captureConsoleIntegration.setupOnce(
      () => undefined,
      () => getMockHubWithIntegration(captureConsoleIntegration) as any,
    );

    const someError = new Error('some error');
    global.console.error(someError);

    expect(mockHub.captureException).toHaveBeenCalledTimes(1);
    expect(mockHub.captureException).toHaveBeenCalledWith(someError);
  });

  it('should capture exception on `console.error` when no levels are provided in constructor', () => {
    const captureConsoleIntegration = new CaptureConsole();
    captureConsoleIntegration.setupOnce(
      () => undefined,
      () => getMockHubWithIntegration(captureConsoleIntegration) as any,
    );

    const someError = new Error('some error');
    global.console.error(someError);

    expect(mockHub.captureException).toHaveBeenCalledTimes(1);
    expect(mockHub.captureException).toHaveBeenCalledWith(someError);
  });

  it('should capture message on `console.log` when no levels are provided in constructor', () => {
    const captureConsoleIntegration = new CaptureConsole();
    captureConsoleIntegration.setupOnce(
      () => undefined,
      () => getMockHubWithIntegration(captureConsoleIntegration) as any,
    );

    global.console.error('some message');

    expect(mockHub.captureMessage).toHaveBeenCalledTimes(1);
    expect(mockHub.captureMessage).toHaveBeenCalledWith('some message');
  });

  it('should capture message when console logs a non-error object with level set to "error"', () => {
    const captureConsoleIntegration = new CaptureConsole({ levels: ['error'] });
    captureConsoleIntegration.setupOnce(
      () => undefined,
      () => getMockHubWithIntegration(captureConsoleIntegration) as any,
    );

    global.console.error('some non-error message');

    expect(mockHub.captureMessage).toHaveBeenCalledTimes(1);
    expect(mockHub.captureMessage).toHaveBeenCalledWith('some non-error message');
    expect(mockHub.captureException).not.toHaveBeenCalled();
  });

  it('should capture a message for non-error log levels', () => {
    const captureConsoleIntegration = new CaptureConsole({ levels: ['info'] });
    captureConsoleIntegration.setupOnce(
      () => undefined,
      () => getMockHubWithIntegration(captureConsoleIntegration) as any,
    );

    global.console.info('some message');

    expect(mockHub.captureMessage).toHaveBeenCalledTimes(1);
    expect(mockHub.captureMessage).toHaveBeenCalledWith('some message');
  });

  it('should call the original console function when console members are called', () => {
    // Mock console log to test if it was called
    const originalConsoleLog = global.console.log;
    const mockConsoleLog = jest.fn();
    global.console.log = mockConsoleLog;

    const captureConsoleIntegration = new CaptureConsole({ levels: ['log'] });
    captureConsoleIntegration.setupOnce(
      () => undefined,
      () => getMockHubWithIntegration(captureConsoleIntegration) as any,
    );

    global.console.log('some message 1', 'some message 2');

    expect(mockConsoleLog).toHaveBeenCalledTimes(1);
    expect(mockConsoleLog).toHaveBeenCalledWith('some message 1', 'some message 2');

    // Reset console log
    global.console.log = originalConsoleLog;
  });

  it('should not wrap any levels that are not members of console', () => {
    const captureConsoleIntegration = new CaptureConsole({ levels: ['log', 'someNonExistingLevel', 'error'] });
    captureConsoleIntegration.setupOnce(
      () => undefined,
      () => getMockHubWithIntegration(captureConsoleIntegration) as any,
    );

    // The provided level should not be created
    expect(global.console['someNonExistingLevel']).toBeUndefined();

    // Ohter levels should be wrapped as expected
    expect(global.console.log).not.toBe(originalConsole.log);
    expect(global.console.error).not.toBe(originalConsole.error);
  });

  it('should wrap the console when the client does not have a registered captureconsole integration, but not capture any messages', () => {
    const captureConsoleIntegration = new CaptureConsole({ levels: ['log', 'error'] });
    captureConsoleIntegration.setupOnce(
      () => undefined,
      () => getMockHubWithIntegration(null) as any, // simulate not having the integration registered
    );

    // Console should be wrapped
    expect(global.console.log).not.toBe(originalConsole.log);
    expect(global.console.error).not.toBe(originalConsole.error);

    // Should not capture messages
    global.console.log('some message');
    expect(mockHub.captureMessage).not.toHaveBeenCalledWith();
  });

  it("should not crash when the original console methods don't exist at time of invocation", () => {
    const originalConsoleLog = global.console.log;
    global.console.log = undefined; // don't `delete` here, otherwise `fill` won't wrap the function

    const captureConsoleIntegration = new CaptureConsole({ levels: ['log'] });
    captureConsoleIntegration.setupOnce(
      () => undefined,
      () => getMockHubWithIntegration(captureConsoleIntegration) as any,
    );

    expect(() => {
      global.console.log('some message');
    }).not.toThrow();

    global.console.log = originalConsoleLog;
  });
});
