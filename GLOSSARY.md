# IPAM

Inventory of a network's address space: which IP addresses exist in each subnet, which are taken, and what equipment answers on them.

## Language

### Address space

**Address**:
A usable IP address inside a subnet. Network and broadcast addresses are not addresses, unless the subnet is set to include them.
_Avoid_: Host, IP slot

**Device**:
A piece of equipment observed on an address, identified by its IP and described by MAC, hostname and vendor.
_Avoid_: Host, client, node

**Free**:
State of an address that can be assigned: not reserved and with no device on it.
_Avoid_: Available, unused

**Reserved**:
State of an address with no device on it that cannot be assigned because it is the gateway or part of a DHCP pool.
_Avoid_: Blocked, excluded

**Occupied**:
State of an address with a device on it, online or offline. It wins over Reserved: a DHCP pool address with a device on it is Occupied.
_Avoid_: Used, taken

**Not usable**:
The network and broadcast IPs of a subnet that does not include them; shown on the address map but never counted as addresses.
_Avoid_: Reserved, invalid

### Discovery

**Agent**:
A program running inside a network that observes devices and reports them to IPAM.
_Avoid_: Scanner, probe, client

**Scan**:
One observation of devices by an agent, delivered as a scan report or as the result of a connector run.
_Avoid_: Sweep, discovery run

**Seen**:
A device is seen when it appears in a scan; this is what sets it online and refreshes its last seen time.
_Avoid_: Pinged, reachable

**Heartbeat**:
The periodic ping an agent sends to IPAM to show it is still connected.
_Avoid_: Keepalive
