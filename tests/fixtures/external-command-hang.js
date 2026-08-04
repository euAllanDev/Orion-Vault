setInterval(() => {}, 1_000);

for await (const chunk of process.stdin) {
  void chunk;
  // Intentionally keep the process alive without responding.
}
