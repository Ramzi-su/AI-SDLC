"""The real client address behind reverse proxies, without trusting forged headers."""
import ipaddress
import logging
import os

logger = logging.getLogger(__name__)

IPNetwork = ipaddress.IPv4Network | ipaddress.IPv6Network


def parse_trusted_proxies(value: str) -> list[IPNetwork]:
    """Comma-separated IPs or CIDR ranges, e.g. "10.0.0.0/8, 172.16.0.5". Invalid entries are skipped."""
    networks = []
    for entry in (part.strip() for part in value.split(",")):
        if not entry:
            continue
        try:
            networks.append(ipaddress.ip_network(entry, strict=False))
        except ValueError:
            logger.error("Ignoring invalid TRUSTED_PROXIES entry: %r", entry)
    return networks


# Addresses of the reverse proxies in front of this API. Empty means the API is reached directly.
TRUSTED_PROXIES = parse_trusted_proxies(os.getenv("TRUSTED_PROXIES", ""))


def _parse_ip(value: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    value = value.strip()
    # "[2001:db8::1]:443" or "203.0.113.7:51234" (some proxies append the port).
    if value.startswith("["):
        value = value[1:value.find("]")] if "]" in value else value
    elif value.count(":") == 1:
        value = value.split(":")[0]
    try:
        return ipaddress.ip_address(value)
    except ValueError:
        return None


def resolve_client_ip(peer: str | None, forwarded_for: str | None, trusted: list[IPNetwork]) -> str:
    """The address to rate-limit on.

    X-Forwarded-For is only believed when the direct peer is a trusted proxy. The header is read
    right to left: each proxy appends the address it received from, so the first address that is
    not one of our proxies is the client. Anything to its left could have been written by the client.
    """
    peer_ip = _parse_ip(peer) if peer else None
    if peer_ip is None:
        return peer or "unknown"

    def is_trusted(ip) -> bool:
        return any(ip in network for network in trusted)

    if not trusted or not is_trusted(peer_ip) or not forwarded_for:
        return str(peer_ip)

    candidate = peer_ip
    for hop in reversed(forwarded_for.split(",")):
        hop_ip = _parse_ip(hop)
        if hop_ip is None:
            # Garbage in the chain: stop at the last address we could verify.
            break
        candidate = hop_ip
        if not is_trusted(hop_ip):
            break
    return str(candidate)
