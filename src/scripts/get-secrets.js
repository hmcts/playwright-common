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

function getTaggedSecrets(keyVaultName) {
  const secretsMap = {};
  const rawSecrets = execSync(
    `az keyvault secret list --vault-name ${keyVaultName} --query "[].{id:id, tags:tags}" -o json`,
    { encoding: "utf-8" }
  );

  const secrets = JSON.parse(rawSecrets);

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
 *
 * @param keyVaultName {@link string} - The name of the Azure Key Vault to fetch secrets from
 * @param exampleEnvFilePath {@link string} - Path to the example .env file (optional, default is .env.example)
 * @param envFilePath {@link string} - Path to the .env file (optional, default is .env)
 *
 */
export function populateSecrets(
  keyVaultName,
  exampleEnvFilePath = DEFAULT_EXAMPLE_ENV_FILE,
  envFilePath = DEFAULT_ENV_FILE
) {
  try {
    const secrets = getTaggedSecrets(keyVaultName);
    updateEnvFile(secrets, exampleEnvFilePath, envFilePath);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}
