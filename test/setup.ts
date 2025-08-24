// Jest setup file for global test configuration
import fse from 'fs-extra';
import path from 'node:path';

// Clean up test artifacts after each test
afterEach(async () => {
  const testProjects = path.resolve('test-projects');
  if (await fse.pathExists(testProjects)) {
    await fse.remove(testProjects);
  }
});