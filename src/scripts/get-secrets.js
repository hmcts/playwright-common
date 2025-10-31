#!/usr/bin/env node

import { execSync } from "child_process";
import * as fs from "fs";
import path from "path";

// Change KEY_VAULT_NAME if you want to use a different environment
// Secrets must be tagged with "e2e": "ENV_VAR_NAME" in Azure Key Vault
// This script looks for the tagged secrets and creates an .env file based on the .env.example file
// Requires: Azure CLI & JQ (brew install azure-cli jq)

// Configuration
const DEFAULT_EXAMPLE_ENV_FILE = ".env.example";
const DEFAULT_ENV_FILE = ".env";

// Get args passed in from command
const args = process.argv.slice(2);

if (!args || !args[0]) {
  showUsage();
}

// Get key vault names from command args
const keyVaultNames = args[0]?.split(",") ?? [];
const trimmedVaults = keyVaultNames
  .map((name) => name.trim())
  .filter((name) => name.length > 0);

if (trimmedVaults.length === 0) {
  showUsage();
}

const exampleEnvFilePath = args[1] || DEFAULT_EXAMPLE_ENV_FILE;
const envFilePath = args[2] || DEFAULT_ENV_FILE;

/**
 * Retrieve secrets from a single Azure Key Vault tagged for E2E usage.
 *
 * @param {string} keyVaultName
 * @returns {Record<string, string>}
 */
function getTaggedSecrets(keyVaultName) {
  /** @type {Record<string, string>} */
  const secretsMap = {};
  const rawSecrets = execSync(
    `az keyvault secret list --vault-name ${keyVaultName} --query "[].{id:id, tags:tags}" -o json`,
    { encoding: "utf-8" }
  );

  const secrets = JSON.parse(rawSecrets);
  if (!Array.isArray(secrets)) {
    throw new Error(
      `Unexpected response when listing secrets for ${keyVaultName}`
    );
  }

  for (const secret of secrets) {
    const secretId = secret.id;
    const tags = secret.tags;

    if (tags && tags.e2e) {
      const envVar = tags.e2e;
      const value = execSync(
        `az keyvault secret show --id "${secretId}" --query "value" -o tsv`,
        { encoding: "utf-8" }
      ).trim();
      console.log(
        `Reading ${path.basename(secretId)} from ${keyVaultName} vault`
      );
      secretsMap[envVar] = value;
    }
  }

  return secretsMap;
}

/**
 * Write the resolved secrets to the env file, keeping the example structure.
 *
 * @param {Record<string, string>} secretsMap
 * @param {string} exampleEnvFilePath
 * @param {string} envFilePath
 */
function updateEnvFile(secretsMap, exampleEnvFilePath, envFilePath) {
  if (!fs.existsSync(exampleEnvFilePath)) {
    console.error(`${exampleEnvFilePath} file not found.`);
    process.exit(1);
  }

  const exampleContent = fs.readFileSync(exampleEnvFilePath, "utf-8");
  const lines = exampleContent.split(/\r?\n/);

  const updatedLines = lines.map((line) => {
    const [key] = line.split("=");
    if (secretsMap[key]) {
      console.log(`Setting ${key}`);
      return `${key}=${secretsMap[key]}`;
    }
    return line;
  });

  fs.writeFileSync(envFilePath, updatedLines.join("\n"), "utf-8");
  console.log(`${envFilePath} file created successfully.`);
}

/**
 * Populates the .env file with secrets from Azure key vault. Maintains the structure of the .env.example file.
 */
function populateSecrets() {
  try {
    /** @type {Record<string, string>} */
    const allSecrets = {};
    for (const vault of trimmedVaults) {
      const secrets = getTaggedSecrets(vault);
      for (const [key, value] of Object.entries(secrets)) {
        allSecrets[key] = value;
      }
    }

    updateEnvFile(allSecrets, exampleEnvFilePath, envFilePath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error:", message);
    process.exit(1);
  }
}

function showUsage() {
  console.error(`
Usage: get-secrets <keyVault1, keyVault2, ..> [example env file path] [env file path]

Example:
    yarn get-secrets "keyVault1, keyVault2" .env.example .env`);
  process.exit(1);
}

populateSecrets();
