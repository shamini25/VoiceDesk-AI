from datetime import datetime
import uuid


def create_escalation(
    reason: str = "Customer requested human assistance"
) -> dict:
    ticket_id = f"ESC-{uuid.uuid4().hex[:8].upper()}"

    escalation = {
        "success": True,
        "ticket_id": ticket_id,
        "status": "Pending Human Support",
        "reason": reason,
        "created_at": datetime.now().isoformat(),
        "message": (
            "Your request has been escalated "
            "to a human support agent."
        ),
    }

    print("Human escalation created:")
    print(escalation)

    return escalation