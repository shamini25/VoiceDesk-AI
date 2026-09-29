from typing import Optional
import re


ORDERS = {
    "ORD1001": {
        "order_id": "ORD1001",
        "status": "In Transit",
        "expected_delivery": "September 14, 2026",
        "items": ["Wireless Headphones"],
    },
    "ORD1002": {
        "order_id": "ORD1002",
        "status": "Delivered",
        "expected_delivery": "September 8, 2026",
        "items": ["Laptop Stand"],
    },
    "ORD1003": {
        "order_id": "ORD1003",
        "status": "Processing",
        "expected_delivery": "September 16, 2026",
        "items": ["Mechanical Keyboard"],
    },
    "ORD1004": {
        "order_id": "ORD1004",
        "status": "Out for Delivery",
        "expected_delivery": "September 10, 2026",
        "items": ["USB-C Hub"],
    },
}


def normalize_order_id(order_id: str) -> str:
    """
    Convert common spoken/transcribed order ID formats
    into the standard ORD#### format.

    Examples:
        ORD1001   -> ORD1001
        ord1001   -> ORD1001
        ORD 1001  -> ORD1001
        order 1001 -> ORD1001
        1001      -> ORD1001
    """

    if not order_id:
        return ""

    value = order_id.strip().upper()

    # Remove spaces, hyphens and common punctuation.
    compact = re.sub(r"[\s\-_]+", "", value)

    # Already in standard format.
    if compact.startswith("ORD"):
        number = compact[3:]

        if number.isdigit():
            return f"ORD{number}"

    # Handle "ORDER1001" / "ORDER 1001"
    if compact.startswith("ORDER"):
        number = compact[5:]

        if number.isdigit():
            return f"ORD{number}"

    # Handle just the numeric portion: "1001"
    if compact.isdigit():
        return f"ORD{compact}"

    # Try to find a 3–6 digit order number anywhere
    # in the transcribed text.
    match = re.search(r"\d{3,6}", compact)

    if match:
        return f"ORD{match.group()}"

    return compact


def get_order_status(order_id: str) -> Optional[dict]:
    normalized_id = normalize_order_id(order_id)

    print(
        f"Order lookup: '{order_id}' -> '{normalized_id}'"
    )

    return ORDERS.get(normalized_id)


if __name__ == "__main__":
    test_inputs = [
        "ORD1001",
        "ord1001",
        "ORD 1001",
        "order 1001",
        "ORDER1001",
        "1001",
    ]

    for value in test_inputs:
        result = get_order_status(value)

        print(
            f"{value:15} -> "
            f"{result['status'] if result else 'NOT FOUND'}"
        )