import { createWriteStream, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { format } from 'node:util';

interface LoggerOptions {
  maxSize?: number; // Max file size in bytes (default: 10MB)
  logDir?: string; // Directory for log files (default: ./logs)
  filename?: string; // Log filename (default: app.log)
}

class Logger {
  private writeStream: NodeJS.WritableStream | null = null;
  private currentLogPath: string;
  private maxSize: number;
  private logDir: string;
  private filename: string;
  private originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
    debug: typeof console.debug;
  };

  constructor(options: LoggerOptions = {}) {
    this.maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB default
    this.logDir = options.logDir || './logs';
    this.filename = options.filename || 'app.log';
    this.currentLogPath = join(this.logDir, this.filename);

    // Store original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console),
      debug: console.debug.bind(console),
    };

    this.initializeLogger();
  }

  private initializeLogger() {
    // Create logs directory if it doesn't exist
    if (!existsSync(this.logDir)) {
      Bun.spawnSync(['mkdir', '-p', this.logDir]);
    }

    // Check if rotation is needed
    this.checkRotation();

    // Create write stream
    this.writeStream = createWriteStream(this.currentLogPath, { flags: 'a' });

    // Override console methods
    this.overrideConsole();
  }

  private checkRotation() {
    if (existsSync(this.currentLogPath)) {
      const stats = statSync(this.currentLogPath);
      if (stats.size >= this.maxSize) {
        this.rotateLog();
      }
    }
  }

  private rotateLog() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedPath = join(this.logDir, `${this.filename}.${timestamp}`);

    // Rename current log file
    Bun.spawnSync(['mv', this.currentLogPath, rotatedPath]);

    // Compress the rotated file
    Bun.spawn(['gzip', rotatedPath]);

    // Clean up old logs (keep last 5 compressed logs)
    this.cleanupOldLogs();
  }

  private cleanupOldLogs() {
    const files = Bun.spawnSync(['ls', '-t', this.logDir])
      .stdout.toString()
      .split('\n')
      .filter((f) => f.endsWith('.gz') && f.startsWith(this.filename));

    if (files.length > 5) {
      for (const file of files.slice(5)) {
        Bun.spawnSync(['rm', join(this.logDir, file)]);
      }
    }
  }

  private formatLogEntry(level: string, args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const message = format(...args);
    return `[${timestamp}] [${level}] ${message}\n`;
  }

  private writeLog(level: string, args: unknown[]) {
    // Write to console
    this.originalConsole[level.toLowerCase() as keyof typeof this.originalConsole](...args);

    // Write to file
    if (this.writeStream) {
      const entry = this.formatLogEntry(level, args);
      this.writeStream.write(entry);

      // Periodic rotation check (simplified for Bun compatibility)
      this.checkRotation();
    }
  }

  private overrideConsole() {
    console.log = (...args: unknown[]) => this.writeLog('LOG', args);
    console.error = (...args: unknown[]) => this.writeLog('ERROR', args);
    console.warn = (...args: unknown[]) => this.writeLog('WARN', args);
    console.info = (...args: unknown[]) => this.writeLog('INFO', args);
    console.debug = (...args: unknown[]) => this.writeLog('DEBUG', args);
  }

  public close() {
    // Restore original console methods
    Object.assign(console, this.originalConsole);

    // Close write stream
    if (this.writeStream) {
      this.writeStream.end();
    }
  }
}

// Create singleton instance
let loggerInstance: Logger | null = null;

export function initializeLogger(options?: LoggerOptions) {
  if (!loggerInstance) {
    loggerInstance = new Logger(options);
  }
  return loggerInstance;
}

export function closeLogger() {
  if (loggerInstance) {
    loggerInstance.close();
    loggerInstance = null;
  }
}

// Initialize logger on module load
initializeLogger();
