import { domainToASCII } from "node:url";

const address = process.argv[2] || "127.0.0.1";
const baseHosts = ["web-platform.test", "not-web-platform.test"];
const labels = ["www", "www1", "www2", "天気の良い日", "élève"];
const subdomains = [
  ...labels,
  ...labels.flatMap((left) => labels.map((right) => `${left}.${right}`)),
];

const domains = baseHosts.flatMap((host) => [
  host,
  ...subdomains.map((subdomain) => `${subdomain}.${host}`),
]);

const entries = [...new Set(domains)]
  .map((domain) => domainToASCII(domain))
  .sort()
  .map((domain) => `${address}\t${domain}`);

process.stdout.write(`${entries.join("\n")}\n`);
