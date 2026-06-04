setInterval(() => {}, 1_000);

for await (const _chunk of process.stdin) {
  // Intentionally keep the process alive without responding.
}
