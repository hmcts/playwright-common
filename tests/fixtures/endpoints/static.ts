// Static endpoint calls (should be detected by AST scanner)
apiClient.get("/health");
client.post("/cases");
anonymousClient.delete("/users/123");
// Duplicate to test counting
apiClient.get("/health");