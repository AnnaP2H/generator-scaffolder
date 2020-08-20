const fs = require('fs');
const chalk = require('chalk');
const chai = require('chai');
const glob = require('glob');
const helpers = require('yeoman-test');
const yeomanAssert = require('yeoman-assert');
const {join} = require('path');
const {getFilesArray, setProcessToDestination, projectTypeMessage} = require(`${process.cwd()}/generators/app/utils`);
const {chaiExecAsync} = require('chai-exec');
const {PROMPTS_VALUES, PATHS, SCRIPTS, GENERAL_TEST_SETTINGS} = require(`${process.cwd()}/generators/app/globals`);
const {cleanUpFolder} = require('./utils');

const ONLY_FILES_TEST = process.env.FILES_ONLY;
const assert = chai.assert;

chai.use(chaiExecAsync);

function bootstrapTest({staticExpectedFiles = [], templatesFilesPath, expectedFilesContent = {}, generalSettings = {}}) {
  return Promise.all([
    GENERAL_TEST_SETTINGS.forEach((prompts) => {
      const testSettings = {...prompts, ...generalSettings, expectedFilesContent, staticExpectedFiles};

      describe(projectTypeMessage(testSettings), () => {
        before(() => {
          return new Promise(async (resolve, reject) => {
            try {
              await cleanUpFolder();
              return helpers.run(PATHS.appFolder).cd(PATHS.tempFolder).withPrompts(testSettings);
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        });

        describe('Generating files:', () => {
          it(chalk.green('Create expected files'), () => {
            return new Promise(async (resolve, reject) => {
              try {
                await setProcessToDestination();

                const unexpectedFiles = testSettings.staticUnexpectedFiles;
                const expectedFiles = [...(await getFilesArray(templatesFilesPath))]
                  .concat([...(await getFilesArray(join(PATHS.templatesFolder, PROMPTS_VALUES.framework.bootstrap)))])
                  .concat(testSettings.staticExpectedFiles);

                yeomanAssert.file(expectedFiles);
                yeomanAssert.noFile(unexpectedFiles);
                resolve();
              } catch (err) {
                reject(err);
              }
            });
          });
        });

        describe('Checking dependencies:', () => {
          it(chalk.green('Setup settings'), () => {
            return new Promise(async (resolve, reject) => {
              try {
                await setProcessToDestination();

                const newCfg = JSON.parse(fs.readFileSync(join(PATHS.tempMarkupFolder, 'config.json')));
                const newPkgfilePath = join(PATHS.tempMarkupFolder, 'package.json');
                const jsFile = join(PATHS.tempMarkupFolder, newCfg.src, newCfg.scripts.src, `${newCfg.scripts.bundle}.${newCfg.scripts.extension}`);
                const stylesFile = join(PATHS.tempMarkupFolder, newCfg.src, newCfg.styles.src, `${newCfg.styles.bundle}.${newCfg.styles.extension}`);

                it(chalk.green('Library imported into JS:'), () => {
                  testSettings.expectedFilesContent.js.map((content) => yeomanAssert.fileContent(jsFile, content));
                });

                it(chalk.green('Library imported into Styles:'), () => {
                  testSettings.expectedFilesContent.styles.map((content) => yeomanAssert.fileContent(stylesFile, content));
                });

                it(chalk.green('Modules added to package.json:'), () => {
                  testSettings.expectedFilesContent.json.map((content) => yeomanAssert.jsonFileContent(newPkgfilePath, content));
                });

                resolve();
              } catch (error) {
                reject(err);
              }
            });
          });
        });

        if (!ONLY_FILES_TEST) {
          describe('Installing dependencies:', () => {
            it(chalk.green('Install all dependencies'), () => {
              return new Promise(async (resolve, reject) => {
                try {
                  const cli = await chaiExecAsync(SCRIPTS.install);
                  assert.exitCode(cli, 0);
                  resolve();
                } catch (error) {
                  reject(err);
                }
              });
            });
          });

          describe('Running build process:', () => {
            it(chalk.green('Build process is correct:'), () => {
              return new Promise(async (resolve, reject) => {
                try {
                  const cli = await chaiExecAsync(SCRIPTS.build);
                  assert.exitCode(cli, 0);
                  resolve();
                } catch (error) {
                  reject(err);
                }
              });
            });
          });

          describe('Building correct files:', () => {
            it(chalk.green('Generate all files based on project config'), () => {
              return new Promise(async (resolve, reject) => {
                try {
                  await setProcessToDestination();
                  const newCfg = JSON.parse(fs.readFileSync(join(PATHS.tempMarkupFolder, 'config.json')));
                  const getStyleFile = () => {
                    return join(newCfg.dest, newCfg.styles.dest, `${newCfg.styles.bundle}.css`);
                  };

                  const stylesFile = getStyleFile();
                  const jsFile = join(newCfg.dest, newCfg.scripts.dest, `${newCfg.scripts.bundle}.${newCfg.scripts.extension}`);
                  const HTMLFiles = join(newCfg.dest, newCfg.templates.dest, `*.${newCfg.templates.extension}`);

                  const expectedCompilation = [stylesFile, jsFile];

                  glob(HTMLFiles, {}, (err, files) => {
                    expectedCompilation.push(...files);
                    yeomanAssert.file(expectedCompilation);
                  });

                  resolve();
                } catch (error) {
                  reject(err);
                }
              });
            });
          });
        }
      });
    }),
  ]);
}

module.exports = bootstrapTest;
