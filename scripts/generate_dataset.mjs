import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'synthetic_tickets.csv');
const TOTAL_TICKETS = 1000;

// ─── Random Helpers ──────────────────────────────
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randIP() { return `${randInt(10,192)}.${randInt(0,255)}.${randInt(0,255)}.${randInt(1,254)}`; }
function randPort() { return pick([22, 80, 443, 3000, 3306, 5432, 6379, 8080, 8443, 9090, 27017]); }
function randServer() { return `${pick(['prod','staging','dev','qa','uat'])}-${pick(['app','web','api','db','cache','worker','proxy','auth','log','monitor'])}-${randInt(1,30)}`; }
function randUser() { return `${pick(['john','sarah','mike','lisa','david','emma','alex','priya','raj','kumar','anil','sneha','ravi','pooja','amit','neha','vikram','ananya','arjun','meera'])}.${pick(['smith','johnson','williams','patel','sharma','gupta','kumar','singh','brown','davis','wilson','miller','jones','garcia','martinez','taylor','anderson','thomas','lee','harris'])}@company.com`; }
function randTeam() { return pick(['Platform Engineering','DevOps','SRE','Backend','Frontend','Mobile','Data','ML','QA','Infrastructure','Cloud','Security','Database','Network','Identity','Compliance']); }
function randEnv() { return pick(['production','staging','development','QA','UAT','pre-prod','sandbox','DR']); }
function randApp() { return pick(['CRM Portal','HR Dashboard','Invoice System','Inventory Manager','Customer Portal','Analytics Dashboard','Payment Gateway','Order Management','Email Service','Notification Hub','Reporting Engine','Admin Console','API Gateway','SSO Portal','Document Manager','Chat Service','Ticket System','Monitoring Dashboard','CI/CD Pipeline','Deployment Manager']); }
function randDB() { return pick(['PostgreSQL','MySQL','MongoDB','Redis','Elasticsearch','Oracle','SQL Server','DynamoDB','Cassandra','MariaDB']); }
function randCloud() { return pick(['AWS','Azure','GCP']); }
function randRegion() { return pick(['us-east-1','us-west-2','eu-west-1','ap-south-1','ap-southeast-1','eu-central-1','us-central1','eastus','westeurope']); }
function randTool() { return pick(['Jenkins','GitHub Actions','GitLab CI','ArgoCD','Terraform','Ansible','Docker','Kubernetes','Helm','Prometheus','Grafana','Datadog','PagerDuty','Splunk','ELK Stack','Vault','Consul']); }
function randVPN() { return pick(['GlobalProtect','Cisco AnyConnect','OpenVPN','WireGuard','FortiClient','Pulse Secure','NordLayer','Zscaler']); }
function randBrowser() { return pick(['Chrome 120','Firefox 121','Safari 17','Edge 120','Chrome 119','Firefox 120']); }
function randOS() { return pick(['Windows 11','Windows 10','macOS Sonoma','macOS Ventura','Ubuntu 22.04','Ubuntu 24.04','RHEL 9','CentOS Stream 9']); }
function randError() { return pick(['ERR_CONNECTION_REFUSED','ERR_TIMEOUT','ERR_SSL_PROTOCOL_ERROR','ECONNRESET','EPERM','EACCES','ENOMEM','ORA-01017','ORA-12541','SQLSTATE[HY000]','Error 500','Error 502','Error 503','Error 504','FATAL ERROR','SEGFAULT','OutOfMemoryError','StackOverflowError','NullPointerException','ConnectionPoolExhausted']); }
function randHTTP() { return pick([400, 401, 403, 404, 408, 429, 500, 502, 503, 504]); }
function randDuration() { return pick(['5 minutes','10 minutes','15 minutes','30 minutes','1 hour','2 hours','3 hours','since this morning','since yesterday','intermittently for 2 days']); }

// ─── Category Templates ──────────────────────────
const CATEGORIES = {
  Infrastructure: {
    templates: [
      () => ({
        title: `${randServer()} disk space critical`,
        description: `Server ${randServer()} in ${randEnv()} environment is at ${randInt(90,99)}% disk usage. ${randTool()} builds are failing due to insufficient space. Affecting the ${randTeam()} team. OS: ${randOS()}.`,
        resolution: `1. SSH into the server and identify large files with \`du -sh /var/*\`.\n2. Prune old Docker images: \`docker system prune -af\`.\n3. Clear old build artifacts and logs older than 30 days.\n4. Expand EBS/disk volume by ${randInt(20,100)}GB.\n5. Set up disk space monitoring alert at 80% threshold.`,
        priority: pick(['Critical','High']),
      }),
      () => ({
        title: `${randTool()} build failures on ${randServer()}`,
        description: `${randTool()} pipeline has been failing for the last ${randDuration()} on ${randServer()}. Error: ${randError()}. All deployments to ${randEnv()} are blocked. Team ${randTeam()} is affected.`,
        resolution: `1. Check ${randTool()} system logs for root cause.\n2. Restart the build agent/runner service.\n3. Verify network connectivity to artifact repositories.\n4. Clear workspace cache and retry the build.\n5. If persistent, provision a new build agent.`,
        priority: pick(['Critical','High']),
      }),
      () => ({
        title: `${randCloud()} EC2/VM instance unreachable`,
        description: `Instance ${randServer()} in ${randCloud()} ${randRegion()} is not responding to SSH or health checks. The ${randApp()} hosted on it is down. Started ${randDuration()} ago.`,
        resolution: `1. Check ${randCloud()} console for instance status checks.\n2. Review system logs and screenshot from console.\n3. If status checks failed, stop and restart the instance.\n4. Verify security group and NACL rules.\n5. If hardware issue, migrate to a new instance.\n6. Update monitoring to catch this earlier.`,
        priority: 'Critical',
      }),
      () => ({
        title: `Docker container crash loop on ${randServer()}`,
        description: `Docker container for ${randApp()} is in a crash loop (CrashLoopBackOff) on ${randServer()}. Logs show: ${randError()}. Environment: ${randEnv()}. Restarted ${randInt(5,50)} times in the last hour.`,
        resolution: `1. Inspect container logs: \`docker logs <container_id>\`.\n2. Check resource limits (memory/CPU) — container may be OOM killed.\n3. Verify environment variables and config mounts.\n4. Roll back to the previous known-good image.\n5. Fix the root cause in application code and redeploy.`,
        priority: pick(['Critical','High']),
      }),
      () => ({
        title: `Kubernetes pod scheduling failures in ${randEnv()}`,
        description: `Multiple pods for ${randApp()} are stuck in Pending state in the ${randEnv()} cluster. kubectl describe shows insufficient CPU/memory. The ${randTeam()} team cannot deploy.`,
        resolution: `1. Check node resource utilization: \`kubectl top nodes\`.\n2. Identify resource-hungry pods: \`kubectl top pods --all-namespaces\`.\n3. Scale up worker node group or add new nodes.\n4. Review and optimize resource requests/limits for pods.\n5. Consider enabling cluster autoscaler.`,
        priority: pick(['High','Medium']),
      }),
      () => ({
        title: `SSL certificate expiring on ${randServer()}`,
        description: `SSL certificate for ${randApp()} on ${randServer()} expires in ${randInt(1,7)} days. Browser showing security warnings. Domain: ${pick(['api','portal','dashboard','app','internal','admin'])}.company.com.`,
        resolution: `1. Generate a new CSR or use Let's Encrypt for auto-renewal.\n2. Install the renewed certificate on the web server.\n3. Verify certificate chain is complete.\n4. Restart the web server/load balancer.\n5. Set up automated certificate renewal and expiry monitoring.`,
        priority: pick(['High','Critical']),
      }),
      () => ({
        title: `${randCloud()} service quota exceeded in ${randRegion()}`,
        description: `Hitting service quota limits for ${pick(['EC2 instances','EBS volumes','Lambda concurrency','S3 buckets','RDS instances','VPCs','Elastic IPs','NAT Gateways'])} in ${randCloud()} ${randRegion()}. Cannot provision new resources for ${randTeam()}.`,
        resolution: `1. Review current quota usage in ${randCloud()} console.\n2. Submit a service quota increase request.\n3. Clean up unused/orphaned resources.\n4. Consider using a different region for non-critical workloads.\n5. Implement resource tagging and lifecycle policies.`,
        priority: pick(['High','Medium']),
      }),
      () => ({
        title: `NTP clock drift detected on ${randServer()}`,
        description: `Clock drift of ${randInt(5,300)} seconds detected on ${randServer()} running ${randOS()}. This is causing authentication failures and log timestamp mismatches for ${randApp()}.`,
        resolution: `1. Check current time offset: \`timedatectl status\`.\n2. Force NTP sync: \`ntpdate -u pool.ntp.org\` or \`chronyc makestep\`.\n3. Verify NTP service is running and configured correctly.\n4. Add NTP monitoring to the alerting infrastructure.\n5. Check if firewall is blocking NTP (UDP 123).`,
        priority: pick(['Medium','High']),
      }),
      () => ({
        title: `Monitoring alerts flooding from ${randEnv()} cluster`,
        description: `Receiving ${randInt(50,500)} alerts per hour from ${randTool()} for the ${randEnv()} environment. Alert fatigue is causing the ${randTeam()} team to miss real issues. Most alerts are for ${pick(['high CPU','high memory','disk I/O','network latency','pod restarts'])}.`,
        resolution: `1. Review and categorize current alert rules.\n2. Increase alert thresholds for non-critical metrics.\n3. Add alert grouping and deduplication rules.\n4. Implement alert silencing for known maintenance windows.\n5. Create tiered alerting: P1 pages, P2 Slack, P3 dashboard only.`,
        priority: pick(['Medium','Low']),
      }),
      () => ({
        title: `Terraform state lock stuck for ${randEnv()} infrastructure`,
        description: `Terraform state is locked for the ${randEnv()} infrastructure in ${randCloud()} ${randRegion()}. Lock ID exists in DynamoDB/Cloud Storage. No one can apply infrastructure changes. Blocking ${randTeam()}.`,
        resolution: `1. Identify who holds the lock: check the lock metadata.\n2. If the previous apply crashed, force-unlock: \`terraform force-unlock <LOCK_ID>\`.\n3. Verify state file integrity after unlocking.\n4. Run \`terraform plan\` to ensure no drift.\n5. Implement CI-based Terraform runs to prevent manual lock conflicts.`,
        priority: pick(['High','Medium']),
      }),
    ],
  },

  Application: {
    templates: [
      () => ({
        title: `${randApp()} returning HTTP ${randHTTP()} errors`,
        description: `${randApp()} is returning HTTP ${randHTTP()} errors for users. Started ${randDuration()} ago. Affecting approximately ${randInt(10,500)} users. Browser: ${randBrowser()}. Error: ${randError()}.`,
        resolution: `1. Check application logs for stack traces and error details.\n2. Verify backend service health and database connectivity.\n3. If 5xx: restart the application pods/processes.\n4. If 4xx: check recent deployment changes for routing/auth issues.\n5. Monitor error rates post-fix and notify affected users.`,
        priority: pick(['Critical','High']),
      }),
      () => ({
        title: `${randApp()} deployment failed in ${randEnv()}`,
        description: `Latest deployment of ${randApp()} to ${randEnv()} has failed. Build passed but rollout shows errors. Error: ${randError()}. ${randTeam()} team is blocked from releasing. Previous version still running.`,
        resolution: `1. Roll back to the previous stable version immediately.\n2. Check deployment logs for the specific failure point.\n3. Verify environment variables and secrets are correctly set.\n4. Run smoke tests against the rolled-back version.\n5. Fix the deployment issue and re-deploy through CI/CD pipeline.`,
        priority: pick(['High','Critical']),
      }),
      () => ({
        title: `${randApp()} memory leak causing OOM crashes`,
        description: `${randApp()} on ${randServer()} is consuming increasing memory over time, eventually hitting OOM and crashing. RSS grows from ${randInt(200,500)}MB to ${randInt(2,8)}GB within ${randInt(2,12)} hours. Environment: ${randEnv()}.`,
        resolution: `1. Generate a heap dump for analysis: use appropriate profiler.\n2. Identify leaking objects/connections using profiling tools.\n3. Check for unclosed database connections, event listeners, or cache growth.\n4. Apply fix and deploy with memory limits.\n5. Set up memory usage alerting at 80% of container limit.`,
        priority: pick(['High','Critical']),
      }),
      () => ({
        title: `API response times degraded for ${randApp()}`,
        description: `Average API response time for ${randApp()} has increased from ${randInt(50,200)}ms to ${randInt(2,15)}s. Users reporting slow page loads. ${randTeam()} dashboard shows timeout spikes. Started ${randDuration()} ago.`,
        resolution: `1. Check APM/tracing for slowest endpoints.\n2. Identify bottleneck: database queries, external API calls, or compute.\n3. Add database query indexes if N+1 queries detected.\n4. Implement caching for frequently accessed data.\n5. Scale horizontally if load has genuinely increased.`,
        priority: pick(['High','Medium']),
      }),
      () => ({
        title: `${randApp()} login page broken after update`,
        description: `Users cannot log into ${randApp()} after the latest release. Login form submits but returns a blank page or ${randError()}. Affecting all users on ${randBrowser()}, ${randOS()}. SSO redirect flow is broken.`,
        resolution: `1. Check frontend console errors in the browser.\n2. Verify SSO/OAuth callback URLs are correctly configured.\n3. Check if the auth service/identity provider is reachable.\n4. Review recent code changes to the login flow.\n5. Roll back the frontend build if needed and redeploy.`,
        priority: 'Critical',
      }),
      () => ({
        title: `Scheduled job failures in ${randApp()}`,
        description: `Cron/scheduled jobs in ${randApp()} have been failing since ${randDuration()} ago. Jobs: ${pick(['report generation','data sync','email digest','cleanup','billing','notifications','analytics aggregation'])}. Error: ${randError()}. Environment: ${randEnv()}.`,
        resolution: `1. Check cron job logs for specific error messages.\n2. Verify database/external service connectivity from the job runner.\n3. Check if job runner has sufficient resources (CPU/memory).\n4. Manually trigger the failed job to test.\n5. Fix the root cause, clear any stuck/orphaned job locks, and re-enable scheduling.`,
        priority: pick(['Medium','High']),
      }),
      () => ({
        title: `${randApp()} file upload failing with size limit error`,
        description: `Users cannot upload files larger than ${randInt(1,10)}MB in ${randApp()}. Error: "Request entity too large" or ${randError()}. This is blocking ${randTeam()} from uploading ${pick(['invoices','reports','contracts','images','documents','spreadsheets'])}.`,
        resolution: `1. Check and increase upload size limits in the web server config (nginx/Apache).\n2. Update application-level body parser limits.\n3. Verify cloud storage (S3/GCS) bucket permissions.\n4. Consider implementing multipart/chunked upload for large files.\n5. Add user-friendly error messages for size limit violations.`,
        priority: pick(['Medium','Low']),
      }),
      () => ({
        title: `${randApp()} sending duplicate ${pick(['emails','notifications','webhooks'])}`,
        description: `${randApp()} is sending duplicate ${pick(['emails','notifications','webhooks','messages'])} to users. Some users received ${randInt(2,10)} copies of the same ${pick(['email','notification','alert'])}. Issue started after the last deployment.`,
        resolution: `1. Check message queue for duplicate entries.\n2. Verify idempotency keys are being used for message dispatch.\n3. Check if multiple instances of the worker are processing the same queue.\n4. Add deduplication logic using message IDs.\n5. Clear the affected queue and reprocess.`,
        priority: pick(['Medium','High']),
      }),
      () => ({
        title: `Mobile app crashing on ${pick(['iOS','Android'])} for ${randApp()}`,
        description: `The mobile app for ${randApp()} is crashing immediately on launch for ${pick(['iOS 17','iOS 18','Android 14','Android 15'])} users. Crash reports show ${randError()}. Approximately ${randInt(50,2000)} crash reports in the last ${randInt(1,24)} hours.`,
        resolution: `1. Pull crash reports from Crashlytics/Sentry.\n2. Identify the crashing stack trace and affected code path.\n3. Release a hotfix build with the crash protection.\n4. If API-related, add backward compatibility on the server side.\n5. Push the fixed build to App Store/Play Store as an expedited review.`,
        priority: pick(['Critical','High']),
      }),
      () => ({
        title: `${randApp()} search functionality returning no results`,
        description: `Search in ${randApp()} returns empty results for all queries. ${pick(['Elasticsearch','Solr','Algolia','OpenSearch'])} index appears to be ${pick(['empty','corrupted','out of sync'])}. Reported by ${randInt(5,50)} users from ${randTeam()}.`,
        resolution: `1. Check search engine cluster health and index status.\n2. Verify the data sync pipeline between the primary database and search index.\n3. Rebuild the search index from the source database.\n4. Verify search query parsing and filtering logic.\n5. Monitor indexing lag to prevent future occurrences.`,
        priority: pick(['High','Medium']),
      }),
    ],
  },

  Security: {
    templates: [
      () => ({
        title: `Suspicious login attempts detected for ${randUser()}`,
        description: `Security alert: ${randInt(10,200)} failed login attempts detected for account ${randUser()} from IP ${randIP()} (${pick(['Russia','China','Nigeria','Brazil','unknown VPN','Tor exit node'])}). Account may be under brute-force attack. Current status: ${pick(['account locked','still active','MFA blocked'])}.`,
        resolution: `1. Temporarily lock the affected user account.\n2. Block the source IP at the WAF/firewall level.\n3. Reset the user's password and require MFA reenrollment.\n4. Review login audit logs for any successful unauthorized access.\n5. Notify the user and their manager about the incident.\n6. Add the IP range to the threat intelligence blocklist.`,
        priority: 'Critical',
      }),
      () => ({
        title: `Malware detected on endpoint ${randServer()}`,
        description: `Endpoint protection (${pick(['CrowdStrike','SentinelOne','Microsoft Defender','Carbon Black','Sophos'])}) flagged a ${pick(['trojan','ransomware','worm','spyware','cryptominer','rootkit'])} on ${randServer()} used by ${randUser()}. File: ${pick(['update.exe','invoice.pdf.exe','svchost_helper.dll','chrome_update.bat'])}. Status: ${pick(['quarantined','active','partially removed'])}.`,
        resolution: `1. Immediately isolate the affected machine from the network.\n2. Run a full system scan with the endpoint protection tool.\n3. Check if the malware has spread to other machines on the network.\n4. Reset all credentials used on the affected machine.\n5. Reimage the machine if the infection is severe.\n6. Submit the malware sample to the threat intelligence team.`,
        priority: 'Critical',
      }),
      () => ({
        title: `Phishing email reported by ${randTeam()} team members`,
        description: `Multiple users from ${randTeam()} reported a phishing email impersonating ${pick(['IT Support','HR Department','CEO','Microsoft','Google','Payroll'])}. Email contains a ${pick(['malicious link','infected attachment','credential harvesting form','fake invoice'])}. ${randInt(3,30)} users may have interacted with it.`,
        resolution: `1. Block the sender domain at the email gateway.\n2. Search mailboxes for the phishing email and delete all instances.\n3. Identify users who clicked the link or opened the attachment.\n4. Force password resets for affected users.\n5. Run endpoint scans on machines that interacted with the email.\n6. Send a company-wide phishing awareness reminder.`,
        priority: pick(['Critical','High']),
      }),
      () => ({
        title: `Unauthorized access to ${randCloud()} console detected`,
        description: `CloudTrail/Activity Log shows unauthorized API calls from an unrecognized IP ${randIP()} using IAM user ${pick(['admin','devops-bot','ci-runner','backup-service'])}. Actions include: ${pick(['ListBuckets','DescribeInstances','GetSecretValue','CreateUser','AttachPolicy'])}. Credentials may be compromised.`,
        resolution: `1. Immediately rotate/deactivate the compromised IAM credentials.\n2. Review CloudTrail logs for all actions taken by the compromised user.\n3. Revert any unauthorized changes (new users, policies, resources).\n4. Enable MFA on all IAM accounts if not already enabled.\n5. Implement IP-based access restrictions for console access.\n6. Conduct a full IAM access review.`,
        priority: 'Critical',
      }),
      () => ({
        title: `Vulnerability scan found ${randInt(5,50)} critical CVEs`,
        description: `Scheduled vulnerability scan of ${randEnv()} environment found ${randInt(5,50)} critical and ${randInt(10,100)} high-severity CVEs. Affected: ${pick(['OpenSSL','Log4j','Apache Struts','Spring Framework','Node.js','nginx','PostgreSQL','Java Runtime'])} on ${randInt(3,20)} servers. Scan tool: ${pick(['Qualys','Nessus','Tenable','Rapid7','Snyk'])}.`,
        resolution: `1. Prioritize critical CVEs with known exploits (CISA KEV catalog).\n2. Apply security patches to affected systems starting with production.\n3. For packages: update dependencies and rebuild containers.\n4. Implement compensating controls (WAF rules) while patching.\n5. Re-run the vulnerability scan to verify remediation.\n6. Update the patch management policy and schedule.`,
        priority: pick(['Critical','High']),
      }),
      () => ({
        title: `Data exfiltration alert from DLP system`,
        description: `DLP system detected ${pick(['large file transfer','bulk email export','USB copy','cloud upload'])} of ${randInt(50,5000)} sensitive records by ${randUser()}. Data classification: ${pick(['PII','financial','healthcare','proprietary','customer data'])}. Destination: ${pick(['personal email','external USB','cloud storage','unknown endpoint'])}.`,
        resolution: `1. Immediately revoke the user's access to sensitive systems.\n2. Interview the user and their manager to determine intent.\n3. Assess the scope of data potentially exfiltrated.\n4. Engage legal/compliance team for incident documentation.\n5. Implement additional DLP rules to prevent recurrence.\n6. File a data breach notification if required by regulations.`,
        priority: 'Critical',
      }),
      () => ({
        title: `WAF blocking legitimate traffic to ${randApp()}`,
        description: `Web Application Firewall is incorrectly blocking legitimate API requests to ${randApp()}. ${randInt(50,500)} false positive blocks in the last hour. WAF rule ${pick(['SQL injection','XSS','bot detection','rate limiting','geo-blocking'])} is too aggressive. Affecting ${randTeam()} operations.`,
        resolution: `1. Review blocked requests in WAF logs to confirm false positives.\n2. Whitelist known-good IP ranges and user agents.\n3. Tune the overly aggressive WAF rule thresholds.\n4. Add custom exception rules for the affected API endpoints.\n5. Monitor for 24 hours after changes to ensure no real attacks slip through.`,
        priority: pick(['High','Medium']),
      }),
      () => ({
        title: `Service account key rotation overdue for ${randCloud()}`,
        description: `${randInt(5,20)} service account keys in ${randCloud()} have not been rotated in ${randInt(90,365)} days, violating the ${randInt(60,90)}-day rotation policy. Accounts used by: ${randApp()}, ${randTool()}. Compliance audit flagged this as a finding.`,
        resolution: `1. Generate new keys for each service account.\n2. Update the keys in all dependent services, CI/CD pipelines, and secret managers.\n3. Revoke the old keys after confirming new keys work.\n4. Implement automated key rotation via ${pick(['Vault','AWS Secrets Manager','Azure Key Vault','GCP Secret Manager'])}.\n5. Set up alerts for key age exceeding policy threshold.`,
        priority: pick(['High','Medium']),
      }),
      () => ({
        title: `SSL/TLS misconfiguration on ${randServer()}`,
        description: `SSL Labs scan reports grade ${pick(['C','D','F'])} for ${randServer()}. Issues: ${pick(['weak ciphers','TLS 1.0/1.1 enabled','missing HSTS','incomplete certificate chain','expired OCSP stapling'])}. This violates company security policy and may expose traffic to interception.`,
        resolution: `1. Disable TLS 1.0 and 1.1 — enforce TLS 1.2+ only.\n2. Remove weak cipher suites (RC4, DES, export ciphers).\n3. Enable HSTS with a minimum 6-month max-age.\n4. Fix certificate chain — include intermediate certificates.\n5. Re-scan with SSL Labs to verify grade A/A+ achieved.`,
        priority: pick(['High','Medium']),
      }),
      () => ({
        title: `Privilege escalation detected in ${randEnv()} environment`,
        description: `SIEM alert: user ${randUser()} escalated privileges from ${pick(['viewer','developer','editor'])} to ${pick(['admin','root','superuser'])} role without authorization in ${randEnv()}. ${pick(['Role binding change','sudo command','IAM policy attachment','admin API call'])} detected.`,
        resolution: `1. Immediately revoke the escalated privileges.\n2. Review audit logs to determine how the escalation occurred.\n3. Check for any actions performed with elevated access.\n4. Patch the privilege escalation vector.\n5. Implement alerts for unauthorized role changes.\n6. Review IAM policies to prevent similar escalation paths.`,
        priority: 'Critical',
      }),
    ],
  },

  Database: {
    templates: [
      () => ({
        title: `${randDB()} connection pool exhausted on ${randServer()}`,
        description: `${randDB()} on ${randServer()} has exhausted its connection pool (${randInt(50,200)}/${randInt(50,200)} connections active). ${randApp()} is returning connection timeout errors. Environment: ${randEnv()}. Started ${randDuration()} ago.`,
        resolution: `1. Identify connections holding open transactions: check \`pg_stat_activity\` or equivalent.\n2. Terminate idle-in-transaction connections older than 5 minutes.\n3. Increase the connection pool size if usage is legitimately high.\n4. Review application code for connection leaks (unclosed connections).\n5. Implement connection pooling middleware (PgBouncer/ProxySQL).`,
        priority: pick(['Critical','High']),
      }),
      () => ({
        title: `Slow query degrading ${randDB()} performance`,
        description: `A slow query on ${randDB()} (${randServer()}) is running for ${randInt(30,600)} seconds, causing table locks and degrading ${randApp()} performance. Query involves ${pick(['full table scan on a 10M row table','missing index on JOIN column','unoptimized aggregation','cartesian product from bad JOIN','recursive CTE timeout'])}. Affecting ${randInt(5,100)} concurrent users.`,
        resolution: `1. Identify the slow query from the slow query log.\n2. Run EXPLAIN ANALYZE to diagnose the execution plan.\n3. Add appropriate indexes based on the query pattern.\n4. Optimize the query (add WHERE filters, limit results, fix JOINs).\n5. Consider query caching for frequently executed queries.\n6. Set up slow query alerting with ${randInt(5,30)}s threshold.`,
        priority: pick(['High','Medium']),
      }),
      () => ({
        title: `${randDB()} replication lag at ${randInt(30,3600)} seconds`,
        description: `Read replica of ${randDB()} on ${randServer()} has a replication lag of ${randInt(30,3600)} seconds. ${randApp()} reads from the replica are returning stale data. This is affecting ${pick(['reporting','user profile reads','dashboard analytics','search results'])}. Environment: ${randEnv()}.`,
        resolution: `1. Check replica status and identify the bottleneck.\n2. Review write throughput on the primary — check for bulk operations.\n3. Ensure the replica has sufficient IOPS and network bandwidth.\n4. Temporarily direct reads to the primary if lag is critical.\n5. Consider adding more replicas or upgrading instance size.\n6. Set up replication lag monitoring with 60s threshold alerts.`,
        priority: pick(['High','Medium']),
      }),
      () => ({
        title: `${randDB()} backup job failed for ${randEnv()}`,
        description: `Nightly ${randDB()} backup for ${randEnv()} environment failed at ${pick(['snapshot stage','compression stage','upload to S3','verification stage'])}. Error: ${pick(['disk space insufficient','network timeout to backup storage','permission denied on backup directory','corrupted WAL segment'])}. Last successful backup was ${randInt(1,7)} days ago.`,
        resolution: `1. Check backup job logs for the specific error.\n2. Verify backup storage has sufficient space.\n3. Ensure backup service account has correct permissions.\n4. Run a manual backup immediately to restore the backup chain.\n5. Verify backup integrity with a test restore.\n6. Set up backup failure alerts to catch issues within 24 hours.`,
        priority: pick(['Critical','High']),
      }),
      () => ({
        title: `Database migration failed for ${randApp()}`,
        description: `Schema migration for ${randApp()} on ${randDB()} (${randEnv()}) failed mid-way. Migration ${pick(['added a column','dropped a table','altered an index','modified constraints','renamed columns'])}. The database is now in an inconsistent state. Rollback was ${pick(['attempted but failed','not attempted','partially successful'])}.`,
        resolution: `1. Assess current schema state vs expected state.\n2. If possible, manually complete or roll back the failed migration.\n3. Fix the migration script for idempotency.\n4. Restore from the pre-migration backup if state is unrecoverable.\n5. Re-run the migration in a staging environment first.\n6. Implement migration dry-run and backup as pre-deployment steps.`,
        priority: pick(['Critical','High']),
      }),
      () => ({
        title: `${randDB()} storage reaching capacity on ${randServer()}`,
        description: `${randDB()} data directory on ${randServer()} is at ${randInt(85,98)}% capacity (${randInt(50,500)}GB / ${randInt(100,512)}GB). If it fills up, the database will go read-only or crash. ${randApp()} and ${randTeam()} will be affected. Growth rate: ${randInt(1,10)}GB/day.`,
        resolution: `1. Identify the largest tables and indexes consuming space.\n2. Run VACUUM/OPTIMIZE to reclaim dead tuple space.\n3. Archive or delete data older than the retention policy.\n4. Expand disk/EBS volume size.\n5. Implement table partitioning for time-series data.\n6. Set up storage alerts at 80% and 90% thresholds.`,
        priority: pick(['High','Critical']),
      }),
      () => ({
        title: `${randDB()} deadlock detected in ${randApp()}`,
        description: `Frequent deadlocks occurring in ${randDB()} when ${randApp()} processes ${pick(['concurrent order updates','batch imports','user session writes','inventory adjustments','payment transactions'])}. ${randInt(10,100)} deadlocks in the last hour. Transaction rollbacks affecting user experience.`,
        resolution: `1. Analyze deadlock logs to identify the conflicting transactions.\n2. Review application locking order — ensure consistent acquisition order.\n3. Reduce transaction scope and duration.\n4. Add appropriate row-level locking hints.\n5. Implement retry logic for deadlock errors in application code.\n6. Consider optimistic locking where possible.`,
        priority: pick(['High','Medium']),
      }),
      () => ({
        title: `${randDB()} user permissions misconfigured for ${randTeam()}`,
        description: `${randTeam()} members have ${pick(['excessive read/write access','no access to required tables','accidental DROP permissions','missing SELECT grants on new tables'])} in ${randDB()} for the ${randEnv()} environment. Discovered during ${pick(['access review','failed query','audit','incident investigation'])}.`,
        resolution: `1. Review current grants for the affected database role.\n2. Revoke excessive permissions immediately.\n3. Grant only the minimum required permissions (principle of least privilege).\n4. Create application-specific roles with scoped access.\n5. Document the permission model and add to onboarding checklist.\n6. Schedule quarterly access reviews.`,
        priority: pick(['Medium','High']),
      }),
      () => ({
        title: `${randDB()} ${pick(['CPU','memory','IOPS'])} at ${randInt(90,100)}% utilization`,
        description: `${randDB()} instance ${randServer()} has been at ${randInt(90,100)}% ${pick(['CPU','memory','IOPS'])} utilization for ${randDuration()}. Query queue is building up. ${randApp()} response times severely degraded. Environment: ${randEnv()}.`,
        resolution: `1. Identify the resource-consuming queries/processes.\n2. Kill any runaway queries that are not critical.\n3. Vertically scale the instance (upgrade CPU/memory).\n4. Optimize the top 5 most expensive queries.\n5. Implement query timeout settings.\n6. Set up proactive alerting at 80% utilization threshold.`,
        priority: pick(['Critical','High']),
      }),
      () => ({
        title: `Data corruption detected in ${randDB()} for ${randApp()}`,
        description: `${randApp()} reporting inconsistent data from ${randDB()}. ${pick(['Primary key violations','orphaned foreign keys','null values in NOT NULL columns','duplicate entries','checksum mismatches'])} found. Affects ${randInt(100,10000)} records. Likely caused by ${pick(['incomplete migration','concurrent write race condition','application bug','disk failure'])}.`,
        resolution: `1. Immediately take a backup of the current (corrupted) state for analysis.\n2. Identify the scope of corrupted records.\n3. If recent, restore from the last known good backup.\n4. Apply transaction logs to recover data up to the corruption point.\n5. Fix the root cause (migration script, application bug, etc.).\n6. Implement data integrity checks as a scheduled job.`,
        priority: 'Critical',
      }),
    ],
  },

  Network: {
    templates: [
      () => ({
        title: `VPN disconnections for remote employees`,
        description: `Multiple remote employees reporting ${randVPN()} VPN disconnecting every ${randInt(2,15)} minutes. Affects ${randInt(5,100)} users across ${pick(['US East','India','Europe','APAC'])} region. Users lose access to internal resources. OS: ${randOS()}. Started ${randDuration()} ago.`,
        resolution: `1. Check VPN gateway logs for disconnect reasons.\n2. Verify VPN server capacity — may need scaling.\n3. Check for MTU mismatch issues — set MTU to 1400 on client.\n4. Update VPN client to the latest version.\n5. Check if ISP-level throttling is affecting VPN traffic.\n6. Enable VPN split-tunneling to reduce gateway load.`,
        priority: pick(['High','Medium']),
      }),
      () => ({
        title: `DNS resolution failures for internal services`,
        description: `Internal DNS resolution failing intermittently. ${pick(['*.internal.company.com','*.svc.cluster.local','internal API endpoints','private hosted zone records'])} not resolving. Affecting ${randInt(3,15)} services including ${randApp()}. DNS server: ${randIP()}. Started ${randDuration()} ago.`,
        resolution: `1. Check DNS server health and query logs.\n2. Verify DNS zone configurations and SOA records.\n3. Flush DNS cache on affected clients: \`ipconfig /flushdns\` or equivalent.\n4. Check if DNS server is overwhelmed — add secondary DNS.\n5. Verify network ACLs are not blocking DNS (UDP/TCP 53).\n6. Test resolution with \`nslookup\` and \`dig\` for debugging.`,
        priority: pick(['Critical','High']),
      }),
      () => ({
        title: `Load balancer health check failures for ${randApp()}`,
        description: `${pick(['ALB','NLB','nginx','HAProxy','Traefik','Envoy'])} load balancer reporting ${randInt(2,10)} out of ${randInt(5,15)} backend targets as unhealthy for ${randApp()}. Health check path: ${pick(['/health','/healthz','/api/status','/ping'])}. Traffic being sent to fewer instances, causing overload.`,
        resolution: `1. Check health check endpoint on failing instances — curl manually.\n2. Verify security groups allow health check traffic from the load balancer.\n3. Check if application is listening on the expected port.\n4. Review application health check logic — it may be failing on DB/dependency checks.\n5. Restart unhealthy instances and monitor.\n6. Increase health check timeout/threshold to avoid flapping.`,
        priority: pick(['High','Critical']),
      }),
      () => ({
        title: `Network latency spike between ${randRegion()} and ${randRegion()}`,
        description: `Cross-region network latency between ${randCloud()} ${randRegion()} and ${randRegion()} spiked from ${randInt(5,30)}ms to ${randInt(200,800)}ms. Affecting ${randApp()} which has components in both regions. ${randTeam()} reporting degraded performance.`,
        resolution: `1. Check ${randCloud()} health dashboard for network issues.\n2. Run traceroute/mtr to identify the network hop causing latency.\n3. If provider issue, open a support case with ${randCloud()}.\n4. Enable caching at the edge to reduce cross-region calls.\n5. Consider deploying service replicas in the same region.\n6. Implement circuit breakers for cross-region dependencies.`,
        priority: pick(['High','Medium']),
      }),
      () => ({
        title: `Firewall rule blocking traffic to ${randApp()}`,
        description: `New firewall rule is inadvertently blocking ${pick(['inbound','outbound'])} traffic on port ${randPort()} to ${randApp()} on ${randServer()}. Deployed ${randDuration()} ago as part of ${pick(['security hardening','compliance update','network restructuring'])}. ${randTeam()} team affected.`,
        resolution: `1. Identify the blocking firewall rule from logs.\n2. Add an exception rule for the required traffic.\n3. Verify the fix with connection tests (telnet/nc).\n4. Review the firewall change process to include impact assessment.\n5. Document the exception in the network security policy.\n6. Implement a change review process for firewall modifications.`,
        priority: pick(['High','Critical']),
      }),
      () => ({
        title: `WiFi connectivity issues in ${pick(['Building A','Floor 3','Meeting Room','Office',' Conference Center','Cafeteria'])}`,
        description: `Multiple employees reporting WiFi dropping or slow speeds in the ${pick(['east wing','west wing','3rd floor','new building','conference area'])}. Speed test shows ${randInt(1,5)}Mbps vs expected ${randInt(100,500)}Mbps. ${randInt(10,50)} users affected. AP model: ${pick(['Cisco Meraki','Aruba','Ubiquiti','Ruckus'])}.`,
        resolution: `1. Check access point dashboard for the affected area.\n2. Verify AP hardware status — reboot if unresponsive.\n3. Check channel congestion and switch to less crowded channels.\n4. Verify PoE switch is providing adequate power to the AP.\n5. Deploy additional APs if coverage is insufficient.\n6. Check for RF interference from nearby devices.`,
        priority: pick(['Medium','Low']),
      }),
      () => ({
        title: `BGP peering session down with ISP`,
        description: `BGP peering session with ${pick(['primary','secondary','backup'])} ISP is down for ${randDuration()}. Prefix advertisements withdrawn. Traffic failover to ${pick(['backup link','secondary ISP'])} is ${pick(['active','partial','not working'])}. External-facing services including ${randApp()} may be affected.`,
        resolution: `1. Check router BGP neighbor status and logs.\n2. Verify physical layer — check for fiber/port issues.\n3. Contact the ISP NOC with BGP session details.\n4. If hardware issue, move to backup port/router.\n5. Verify failover routing is working correctly.\n6. After restoration, verify all prefixes are being advertised.`,
        priority: 'Critical',
      }),
      () => ({
        title: `CDN cache invalidation not propagating for ${randApp()}`,
        description: `After deploying updated static assets for ${randApp()}, CDN (${pick(['CloudFront','Cloudflare','Akamai','Fastly'])}) is still serving stale content. Cache invalidation was triggered but has not propagated globally. Users in ${pick(['EU','APAC','US West','South America'])} still seeing old version.`,
        resolution: `1. Verify invalidation request was submitted successfully.\n2. Check invalidation status in CDN dashboard.\n3. Force a wildcard invalidation if targeted invalidation isn't working.\n4. Add cache-busting query parameters to asset URLs as a workaround.\n5. Review cache TTL settings — reduce for frequently updated assets.\n6. Implement versioned filenames for static assets.`,
        priority: pick(['Medium','High']),
      }),
      () => ({
        title: `${pick(['SMTP','IMAP'])} mail server connectivity issues`,
        description: `Email service disrupted — ${pick(['outgoing emails stuck in queue','users cannot receive email','attachments not sending','email sync failing'])}. Mail server: ${pick(['Exchange Online','Postfix','SendGrid','SES'])}. ${randInt(20,200)} users in ${randTeam()} affected. Error: ${pick(['connection refused','TLS handshake failure','authentication rejected','mailbox full'])}.`,
        resolution: `1. Check mail server status and queue depth.\n2. Verify DNS MX records are correct.\n3. Check TLS certificate validity on the mail server.\n4. Test SMTP connectivity: \`telnet mailserver 25/587\`.\n5. Clear stuck messages from the mail queue.\n6. If cloud-hosted, check service health dashboard.`,
        priority: pick(['High','Medium']),
      }),
      () => ({
        title: `Bandwidth throttling detected on ${randServer()}`,
        description: `Network throughput on ${randServer()} limited to ${randInt(10,100)}Mbps instead of expected ${randInt(1,10)}Gbps. ${pick(['Data transfer jobs','backups','replication','API calls'])} running ${randInt(5,50)}x slower than normal. Issue detected by ${randTeam()} team.`,
        resolution: `1. Check NIC configuration — verify speed/duplex settings.\n2. Check for QoS policies or traffic shaping rules.\n3. Run iperf3 between affected servers to measure actual throughput.\n4. Verify switch port configuration matches expected speed.\n5. Replace network cable if physical layer issue suspected.\n6. Check for VM-level network throttling in hypervisor settings.`,
        priority: pick(['High','Medium']),
      }),
    ],
  },

  'Access Management': {
    templates: [
      () => ({
        title: `Account locked out for ${randUser()}`,
        description: `User ${randUser()} from ${randTeam()} is locked out of their Active Directory account after ${randInt(3,10)} failed password attempts. Unable to access any company systems including ${randApp()}, email, and VPN. User is working remotely.`,
        resolution: `1. Verify user identity through secondary authentication (phone/Slack).\n2. Unlock the AD account via Active Directory Users and Computers.\n3. Reset the password to a temporary value.\n4. Ensure user changes password at next login.\n5. Check login logs for suspicious activity from other IPs.\n6. If legitimate lockout, educate user on password manager usage.`,
        priority: pick(['Medium','High']),
      }),
      () => ({
        title: `New employee access provisioning for ${randTeam()}`,
        description: `New employee joining ${randTeam()} needs access to: ${pickN(['Active Directory','Office 365','Slack','GitHub','Jira','Confluence','AWS Console','VPN','CRM','HR Portal','CI/CD Pipeline','Monitoring Dashboard'], randInt(3,6)).join(', ')}. Start date: ${pick(['today','tomorrow','Monday'])}. Manager has approved.`,
        resolution: `1. Create Active Directory account with standard group memberships.\n2. Assign Office 365 license and create mailbox.\n3. Add to relevant Slack channels and GitHub teams.\n4. Provision access to requested applications per team role template.\n5. Set up VPN profile and send credentials.\n6. Send welcome email with access details and onboarding guide.`,
        priority: pick(['Medium','Low']),
      }),
      () => ({
        title: `SSO login failing for ${randApp()}`,
        description: `Users cannot authenticate to ${randApp()} via SSO (${pick(['Okta','Azure AD','OneLogin','Ping Identity','Auth0'])}). Getting "${pick(['SAML assertion invalid','Token expired','Redirect loop','401 Unauthorized','Identity provider unreachable'])}" error. ${randInt(5,100)} users affected. Started ${randDuration()} ago.`,
        resolution: `1. Check SSO provider dashboard for service status.\n2. Verify SAML/OIDC configuration — check certificate expiry.\n3. Test SSO login in incognito mode to rule out cache issues.\n4. If certificate expired, upload the new IdP certificate.\n5. Check clock sync between IdP and SP (SAML is time-sensitive).\n6. Enable SSO debug logging and review assertion content.`,
        priority: pick(['Critical','High']),
      }),
      () => ({
        title: `MFA enrollment issues for ${randTeam()} users`,
        description: `${randInt(3,20)} users from ${randTeam()} unable to complete MFA enrollment with ${pick(['Microsoft Authenticator','Google Authenticator','YubiKey','Duo Security','Authy'])}. QR code ${pick(['not scanning','generating error','showing expired'])}. Users cannot access MFA-protected resources.`,
        resolution: `1. Reset MFA enrollment for the affected users.\n2. Generate new QR codes/activation links.\n3. Walk users through enrollment step-by-step.\n4. Verify device time is accurate (TOTP is time-sensitive).\n5. Offer alternative MFA methods (SMS/email) as backup.\n6. If hardware token issue, replace the security key.`,
        priority: pick(['Medium','High']),
      }),
      () => ({
        title: `Permission request for ${randCloud()} resources`,
        description: `${randUser()} from ${randTeam()} requesting ${pick(['read-only','read-write','admin'])} access to ${randCloud()} ${pick(['S3 bucket','EC2 instances','RDS database','Lambda functions','CloudWatch logs','IAM console','Kubernetes cluster'])} in ${randEnv()} environment. Business justification: ${pick(['debugging production issue','deploying new feature','running data analysis','setting up monitoring','compliance audit'])}.`,
        resolution: `1. Verify the request and manager approval.\n2. Create/identify an appropriate IAM role or group.\n3. Grant scoped access following least-privilege principle.\n4. Set an access expiration date if this is temporary access.\n5. Document the access grant in the access management log.\n6. Notify the user that access has been provisioned.`,
        priority: pick(['Medium','Low']),
      }),
      () => ({
        title: `Employee offboarding — revoke access for ${randUser()}`,
        description: `${randUser()} from ${randTeam()} has ${pick(['resigned','been terminated','transferred to another department'])}. All access must be revoked immediately per security policy. Manager confirmed. Last working day: ${pick(['today','yesterday','end of week'])}.`,
        resolution: `1. Disable Active Directory account immediately.\n2. Revoke all SSO sessions and OAuth tokens.\n3. Remove from all application access groups.\n4. Disable ${randCloud()} IAM access and rotate shared credentials they had access to.\n5. Transfer ownership of shared documents and resources.\n6. Archive mailbox per retention policy.\n7. Document revocation for compliance audit trail.`,
        priority: pick(['High','Critical']),
      }),
      () => ({
        title: `Password reset request for ${pick(['email','VPN','AD','CRM'])} account`,
        description: `${randUser()} from ${randTeam()} requesting password reset for their ${pick(['primary AD','email','VPN','CRM Portal','HR Dashboard'])} account. Reason: ${pick(['forgot password','password expired','account shows compromised warning','returning from extended leave'])}. Identity verified via ${pick(['Slack DM','phone call','manager email'])}.`,
        resolution: `1. Verify user identity through approved verification method.\n2. Reset password to a temporary value meeting complexity requirements.\n3. Set "must change at next login" flag.\n4. Communicate temporary password via secure channel.\n5. Confirm user can log in successfully.\n6. If compromised warning: review login history and enable MFA.`,
        priority: pick(['Low','Medium']),
      }),
      () => ({
        title: `API key generation request for ${randApp()}`,
        description: `${randUser()} from ${randTeam()} needs API keys for ${randApp()} in ${randEnv()} environment. Purpose: ${pick(['CI/CD integration','automated testing','data migration','third-party integration','monitoring setup'])}. Needs ${pick(['read-only','read-write'])} access scope.`,
        resolution: `1. Verify the request and business justification.\n2. Generate API key with the minimum required scope.\n3. Store the key in ${pick(['Vault','AWS Secrets Manager','Azure Key Vault','environment variables'])}.\n4. Set key expiration per security policy (max 90 days).\n5. Document the API key and its purpose in the access log.\n6. Share the key securely (never via email or chat).`,
        priority: pick(['Low','Medium']),
      }),
      () => ({
        title: `Group membership update for ${randTeam()}`,
        description: `${randInt(3,15)} users need to be ${pick(['added to','removed from'])} the ${pick(['admin','developer','read-only','data-analyst','support','manager'])} group for ${randApp()}. Requested by team lead. Reason: ${pick(['team restructuring','project assignment','role change','access review cleanup'])}.`,
        resolution: `1. Verify the request with the team lead/manager.\n2. Review the group permissions to ensure appropriateness.\n3. Add/remove the specified users from the group.\n4. Verify each user's access is updated correctly.\n5. Notify affected users of the change.\n6. Update the team access matrix documentation.`,
        priority: pick(['Low','Medium']),
      }),
      () => ({
        title: `Shared service account password rotation for ${randApp()}`,
        description: `Shared service account used by ${randApp()} across ${randTeam()} needs password rotation. Current password has been in use for ${randInt(60,365)} days, violating ${randInt(60,90)}-day rotation policy. ${randInt(3,10)} team members know the current password.`,
        resolution: `1. Generate a new strong password meeting policy requirements.\n2. Update the password in the identity provider.\n3. Update all services/scripts using this credential.\n4. Store new password in shared password manager (Vault/1Password).\n5. Revoke knowledge of old password from team members.\n6. Consider replacing shared accounts with per-user service accounts.\n7. Implement automated rotation via secret management tool.`,
        priority: pick(['Medium','High']),
      }),
    ],
  },
};

// ─── CSV Escape ──────────────────────────────────
function csvEscape(str) {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ─── Generate Dataset ────────────────────────────
function generate() {
  const categories = Object.keys(CATEGORIES);
  const ticketsPerCategory = Math.floor(TOTAL_TICKETS / categories.length);
  const remainder = TOTAL_TICKETS - (ticketsPerCategory * categories.length);

  const rows = [];
  rows.push('title,description,category,resolution,priority');

  for (let ci = 0; ci < categories.length; ci++) {
    const categoryName = categories[ci];
    const templates = CATEGORIES[categoryName].templates;
    const count = ticketsPerCategory + (ci < remainder ? 1 : 0);

    for (let i = 0; i < count; i++) {
      const template = templates[i % templates.length];
      const ticket = template();

      rows.push([
        csvEscape(ticket.title),
        csvEscape(ticket.description),
        csvEscape(categoryName),
        csvEscape(ticket.resolution),
        csvEscape(ticket.priority),
      ].join(','));
    }
  }

  // Shuffle rows (skip header)
  const header = rows[0];
  const data = rows.slice(1);
  for (let i = data.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [data[i], data[j]] = [data[j], data[i]];
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, [header, ...data].join('\n'), 'utf-8');
  console.log(`✅ Generated ${data.length} synthetic tickets → ${OUTPUT_FILE}`);
}

generate();
