# Quick Port Check Commands

Run these commands directly on your servers to check port availability **before** deploying.

## On Frontend Server (172.28.92.56)

Check if ports 8080 and 8443 are available:

```bash
# Method 1: Using netstat
netstat -tuln | grep -E ':(8080|8443) '

# Method 2: Using ss (modern alternative)
ss -tuln | grep -E ':(8080|8443) '

# Method 3: Using lsof
lsof -i :8080 -i :8443

# Method 4: Simple check (if nothing shows, ports are free)
sudo netstat -tulpn | grep -E ':(8080|8443) '
```

**Expected Result:**
- **No output** = Ports are available ✅
- **Shows process info** = Ports are in use ⚠️

## On Backend Server (172.28.92.57)

Check if ports 6001 and 5433 are available:

```bash
# Method 1: Using netstat
netstat -tuln | grep -E ':(6001|5433) '

# Method 2: Using ss
ss -tuln | grep -E ':(6001|5433) '

# Method 3: Using lsof
lsof -i :6001 -i :5433

# Method 4: Simple check
sudo netstat -tulpn | grep -E ':(6001|5433) '
```

**Expected Result:**
- **No output** = Ports are available ✅
- **Shows process info** = Ports are in use ⚠️

## If Ports Are In Use

Find what's using the port:

```bash
# Find process using port 8080
sudo lsof -i :8080
# or
sudo netstat -tulpn | grep :8080

# Kill the process (if safe to do so)
sudo kill -9 <PID>
```

## After Getting Code to Server

Once you've pulled the code from GitHub, you can use the automated script:

```bash
chmod +x scripts/check-ports.sh
./scripts/check-ports.sh
```

