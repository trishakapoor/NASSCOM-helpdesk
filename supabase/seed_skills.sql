-- ═══════════════════════════════════════════════════════════════
-- SEED: Procedural Skill DAGs for the Multi-Agent Council
-- Each skill is a deterministic runbook an Agent can execute
-- without LLM assistance (Air-Gapped Mode)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO agentic_skills (category, applicability_logic, execution_steps, termination_criteria) VALUES

('Network',
 'Applies when the issue involves VPN disconnections, DNS resolution failures, firewall blocks, packet loss, BGP peering issues, Wi-Fi authentication failures, or any Layer 2/3/4 connectivity problem.',
 '## Network Diagnostic Runbook

1. **Verify Physical/Virtual Link State**
   - Run `ip link show` or `Get-NetAdapter` to confirm the NIC is UP.
   - Check cable seating or virtual switch binding.

2. **Test DNS Resolution**
   - Execute `nslookup <target_host>` and `dig @8.8.8.8 <target_host>`.
   - If DNS fails, flush cache: `ipconfig /flushdns` or `systemd-resolve --flush-caches`.

3. **Trace Route to Target**
   - Run `tracert <target_ip>` (Windows) or `traceroute -I <target_ip>` (Linux).
   - Identify the hop where latency spikes or packets drop.

4. **Check VPN/Tunnel Status**
   - Verify VPN client logs (Cisco AnyConnect: `%LOCALAPPDATA%\Cisco\AnyConnect\Logs`).
   - Re-authenticate credentials and check certificate expiry.

5. **Inspect Firewall Rules**
   - Review inbound/outbound rules: `netsh advfirewall show allprofiles`.
   - Temporarily disable host firewall to isolate the issue.',
 'Terminate when: (a) connectivity is restored and verified via `ping` + `curl`, OR (b) the issue is identified as upstream infrastructure requiring L2/L3 NOC escalation.'),

('Database',
 'Applies when the issue involves SQL query failures, deadlocks, replication lag, connection pool exhaustion, schema migration errors, backup/restore failures, or any RDBMS/NoSQL operational problem.',
 '## Database Diagnostic Runbook

1. **Check Active Connections & Locks**
   - PostgreSQL: `SELECT * FROM pg_stat_activity WHERE state = ''active'';`
   - Identify blocking PIDs: `SELECT * FROM pg_locks WHERE NOT granted;`

2. **Terminate Deadlocked Processes**
   - Kill the blocking backend: `SELECT pg_terminate_backend(<pid>);`
   - Verify lock release: re-query `pg_locks`.

3. **Analyze Query Performance**
   - Run `EXPLAIN ANALYZE` on the failing query.
   - Check for sequential scans on large tables — add indexes if missing.

4. **Verify Replication Health**
   - Check replica lag: `SELECT now() - pg_last_xact_replay_timestamp() AS lag;`
   - If lag > 30s, check WAL sender status and network between primary/replica.

5. **Connection Pool Audit**
   - Check pool saturation in PgBouncer/Supavisor logs.
   - Increase `max_connections` or `pool_size` if consistently at capacity.',
 'Terminate when: (a) the query executes successfully, OR (b) the deadlock is cleared and application confirms normal operation, OR (c) the issue requires DBA-level schema changes requiring L2 escalation.'),

('Application',
 'Applies when the issue involves application crashes, error codes, software installation failures, performance degradation, browser errors, Office suite problems, or any end-user software malfunction.',
 '## Application Diagnostic Runbook

1. **Collect Error Context**
   - Note the exact error code/message (e.g., 0x8004010F, SIGABRT).
   - Check Windows Event Viewer: `eventvwr.msc` → Application Logs.

2. **Clear Application Cache & State**
   - Delete local cache: `%LOCALAPPDATA%\<AppName>\Cache`.
   - For Outlook: run `outlook.exe /cleanviews` or rebuild the OST file.

3. **Repair/Reinstall the Application**
   - Windows: Settings → Apps → Select App → Modify/Repair.
   - If repair fails, perform a clean uninstall and reinstall from the enterprise software portal.

4. **Check Runtime Dependencies**
   - Verify .NET Framework, Visual C++ Redistributables, and Java versions.
   - Run `sfc /scannow` to check system file integrity.

5. **Test in Safe Mode / Clean Boot**
   - Boot with `msconfig` → Selective Startup to rule out third-party conflicts.',
 'Terminate when: (a) the application launches and operates normally, OR (b) the error is reproducible only under specific conditions requiring vendor support escalation.'),

('Infrastructure',
 'Applies when the issue involves server hardware failures, VM provisioning errors, disk space exhaustion, Docker/Kubernetes pod crashes, CI/CD pipeline failures, cloud resource misconfigurations, or any compute/storage/orchestration problem.',
 '## Infrastructure Diagnostic Runbook

1. **Check System Resources**
   - Run `top` / `htop` (Linux) or Task Manager (Windows) to check CPU/RAM.
   - Verify disk: `df -h` or `Get-PSDrive` — alert if any mount > 90%.

2. **Inspect Container/Pod Health**
   - Kubernetes: `kubectl get pods -A | grep -v Running`.
   - Docker: `docker ps -a --filter "status=exited"`.
   - Check logs: `kubectl logs <pod> --tail=50` or `docker logs <container>`.

3. **Verify Service Status**
   - Systemd: `systemctl status <service>` and `journalctl -u <service> --since "1 hour ago"`.
   - Check for OOMKilled events in `dmesg` or pod describe output.

4. **Validate CI/CD Pipeline**
   - Check the last build/deploy logs in Jenkins/GitHub Actions/GitLab CI.
   - Verify secrets, environment variables, and artifact registry access.

5. **Cloud Resource Audit**
   - Check IAM permissions, security group rules, and resource quotas.
   - Verify the instance type has sufficient vCPUs/memory for the workload.',
 'Terminate when: (a) the service/container is healthy and responding, OR (b) a hardware fault or quota limit is confirmed requiring cloud ops / L2 escalation.'),

('Security',
 'Applies when the issue involves phishing attempts, malware detection, unauthorized access alerts, MFA failures, certificate errors, compliance violations, or any information security incident.',
 '## Security Incident Response Runbook

1. **Classify the Threat**
   - Determine type: phishing, malware, unauthorized access, data leak, or policy violation.
   - Assign severity: P1 (active breach), P2 (confirmed threat), P3 (suspicious activity).

2. **Contain the Threat**
   - Isolate the affected endpoint from the network immediately.
   - Disable compromised user accounts in Active Directory / IdP.
   - Block malicious IPs/domains at the firewall/proxy level.

3. **Collect Forensic Evidence**
   - Capture memory dump if malware is suspected.
   - Export relevant logs: SIEM alerts, email headers, proxy logs.
   - Preserve chain of custody for compliance.

4. **Remediate**
   - Run full antivirus/EDR scan on the affected endpoint.
   - Reset all credentials for the compromised account (including service accounts).
   - Revoke and re-issue any exposed certificates or API keys.

5. **Post-Incident Review**
   - Document the timeline, attack vector, and remediation steps.
   - Update detection rules/signatures to prevent recurrence.',
 'Terminate when: (a) the threat is neutralized and containment is verified, OR (b) the incident is classified as P1 requiring immediate CISO/SOC escalation.'),

('Access Management',
 'Applies when the issue involves password resets, account lockouts, MFA enrollment issues, SSO login failures, permission/role assignment errors, or any identity and access management problem.',
 '## Access Management Runbook

1. **Verify User Identity**
   - Confirm the requester''s identity via corporate email or manager approval.
   - Check the user''s account status in Active Directory / Okta / Azure AD.

2. **Diagnose the Lock/Failure**
   - Check for account lockout: `Get-ADUser <user> -Properties LockedOut,BadLogonCount`.
   - Review login failure reason codes in the IdP audit log.
   - Verify MFA device registration status.

3. **Execute the Reset**
   - Unlock the account: `Unlock-ADAccount -Identity <user>`.
   - Reset password to a temporary value and force change at next login.
   - If MFA device is lost, reset MFA enrollment and guide re-registration.

4. **Verify Access Restoration**
   - Ask the user to attempt login from their primary workstation.
   - Confirm SSO token propagation by testing access to 2-3 enterprise apps.

5. **Audit Trail**
   - Log the access change in the ITSM ticketing system.
   - If the lockout was caused by a brute-force attempt, escalate to Security.',
 'Terminate when: (a) the user confirms successful login and access to required resources, OR (b) the account issue is linked to a security incident requiring Security team escalation.')

ON CONFLICT (category) DO UPDATE SET
  applicability_logic = EXCLUDED.applicability_logic,
  execution_steps = EXCLUDED.execution_steps,
  termination_criteria = EXCLUDED.termination_criteria;
