#!/usr/bin/env node

import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const githubToken = process.env.GITHUB_TOKEN;

if (!githubToken) {
    console.error("Missing GITHUB_TOKEN");
    process.exit(1);
}

const owner = "hmcts";
const branch = "nightly-dev";

// Get repo arg from command
const repo = process.argv[2];

if (!repo) {
    showUsage();
}

const githubApiUrl = `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`;

const headers = {
    Authorization: `token ${githubToken}`,
    Accept: "application/vnd.github.v3+json",
};

async function checkBranchExists() {
    try {
        const response = await axios.get(githubApiUrl, {headers});
        if (response.status === 200) {
            console.log(`Branch ${branch} exists.`);
            return true;
        }
    } catch (error) {
        if (
            axios.isAxiosError(error) &&
            error.response &&
            error.response.status === 404
        ) {
            console.log(`Branch ${branch} does not exist.`);
            return false;
        } else {
            console.error("Error checking if branch exists:", error);
            throw error;
        }
    }
}

async function deleteBranch() {
    try {
        const response = await axios.delete(githubApiUrl, {headers});
        if (response.status === 204) {
            console.log(`Branch ${branch} deleted successfully.`);
        }
    } catch (error) {
        console.error("Error deleting branch:", error);
        throw error;
    }
}

async function main() {
    const branchExists = await checkBranchExists();
    if (branchExists) {
        await deleteBranch();
    }
}

function showUsage() {
  console.error(`
Usage: delete-branch <repo>

Example:
    yarn delete-nightly-dev-branch prl-e2e-tests`);
  process.exit(1);
}

main().catch((error) => console.error("Unexpected error:", error));
