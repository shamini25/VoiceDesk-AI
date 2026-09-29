import json
import os
import uuid
from datetime import datetime
from typing import Optional


# ============================================================
# ANALYTICS HELPERS
# ============================================================

def safe_int(value, default: int = 0) -> int:
    """
    Convert analytics values to integers safely.
    """
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


# ============================================================
# ANALYTICS STORAGE
# ============================================================

ANALYTICS_DIR = os.path.join(
    os.path.dirname(__file__),
    "data",
)

ANALYTICS_FILE = os.path.join(
    ANALYTICS_DIR,
    "analytics.json",
)


# ============================================================
# INITIALIZE STORAGE
# ============================================================

def initialize_storage() -> None:
    """
    Create the analytics data directory and JSON file
    if they do not already exist.
    """

    os.makedirs(
        ANALYTICS_DIR,
        exist_ok=True,
    )

    if not os.path.exists(ANALYTICS_FILE):
        with open(
            ANALYTICS_FILE,
            "w",
            encoding="utf-8",
        ) as file:
            json.dump(
                {
                    "sessions": []
                },
                file,
                indent=2,
            )


# ============================================================
# LOAD ANALYTICS
# ============================================================

def load_analytics() -> dict:
    """
    Load analytics data from the JSON file.
    """

    initialize_storage()

    try:
        with open(
            ANALYTICS_FILE,
            "r",
            encoding="utf-8",
        ) as file:
            data = json.load(file)

        if not isinstance(data, dict):
            return {
                "sessions": []
            }

        if "sessions" not in data:
            data["sessions"] = []

        return data

    except (
        json.JSONDecodeError,
        OSError,
    ):
        return {
            "sessions": []
        }


# ============================================================
# SAVE ANALYTICS
# ============================================================

def save_analytics(
    data: dict,
) -> None:
    """
    Save analytics data to the JSON file.
    """

    initialize_storage()

    with open(
        ANALYTICS_FILE,
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            data,
            file,
            indent=2,
            ensure_ascii=False,
        )


# ============================================================
# CREATE SESSION
# ============================================================

def create_session() -> dict:
    """
    Create a new VoiceDesk AI analytics session.
    """

    session_id = (
        f"SES-{uuid.uuid4().hex[:8].upper()}"
    )

    session = {
        "session_id": session_id,

        "started_at":
            datetime.now().isoformat(),

        "ended_at": None,

        # Message statistics
        "message_count": 0,
        "customer_messages": 0,
        "agent_messages": 0,
        "total_messages": 0,

        # Sentiment statistics
        "sentiment": {
            "positive": 0,
            "neutral": 0,
            "negative": 0,
        },

        # Frustration statistics
        "frustration": {
            "low": 0,
            "medium": 0,
            "high": 0,
        },

        # Tool usage
        "tool_usage": {
            "knowledge_search": 0,
            "order_status": 0,
            "human_escalation": 0,
        },

        # Escalation
        "escalated": False,
        "escalation_ticket": None,

        # Full conversation
        "messages": [],
    }

    data = load_analytics()

    data["sessions"].append(
        session
    )

    save_analytics(data)

    return session


# ============================================================
# FIND SESSION
# ============================================================

def find_session(session_id: str):
    data = load_analytics()

    sessions = data.get("sessions", [])

    target_id = session_id.strip()

    for session in sessions:
        if session.get("session_id") == target_id:
            return session

    return None

# ============================================================
# UPDATE SESSION
# ============================================================

def update_session(
    session_id: str,
    session_data: dict,
) -> Optional[dict]:
    """
    Update an existing analytics session.
    """

    data = load_analytics()

    for index, session in enumerate(
        data["sessions"]
    ):

        if (
            session.get("session_id")
            == session_id
        ):

            data["sessions"][index] = (
                session_data
            )

            save_analytics(data)

            return session_data

    return None


# ============================================================
# ADD CUSTOMER MESSAGE
# ============================================================

def add_customer_message(
    session_id: str,
    text: str,
    sentiment_data: Optional[dict] = None,
) -> Optional[dict]:
    """
    Store a customer message and its
    sentiment/frustration information.
    """

    session = find_session(
        session_id
    )

    if not session:
        return None

    # ----------------------------------------
    # Message object
    # ----------------------------------------

    message = {
        "timestamp":
            datetime.now().isoformat(),

        "speaker":
            "customer",

        "text":
            text,

        "sentiment":
            None,

        "frustration":
            None,

        "frustration_score":
            None,

        "escalation_recommended":
            False,
    }

    # ----------------------------------------
    # Sentiment data
    # ----------------------------------------

    if sentiment_data:

        sentiment = (
            sentiment_data.get(
                "sentiment"
            )
        )

        frustration = (
            sentiment_data.get(
                "frustration"
            )
        )

        frustration_score = (
            sentiment_data.get(
                "frustration_score",
                0,
            )
        )

        escalation_recommended = (
            sentiment_data.get(
                "escalation_recommended",
                False,
            )
        )

        message[
            "sentiment"
        ] = sentiment

        message[
            "frustration"
        ] = frustration

        message[
            "frustration_score"
        ] = frustration_score

        message[
            "escalation_recommended"
        ] = (
            escalation_recommended
        )

        # ----------------------------------------
        # Update sentiment totals
        # ----------------------------------------

        if sentiment in session[
            "sentiment"
        ]:

            session[
                "sentiment"
            ][sentiment] += 1

        # ----------------------------------------
        # Update frustration totals
        # ----------------------------------------

        if frustration in session[
            "frustration"
        ]:

            session[
                "frustration"
            ][frustration] += 1

    # ----------------------------------------
    # Store message
    # ----------------------------------------

    session[
        "messages"
    ].append(message)

    # ----------------------------------------
    # Update message counters
    # ----------------------------------------

    session[
        "customer_messages"
    ] = (
        session.get(
            "customer_messages",
            0,
        ) + 1
    )

    session[
        "total_messages"
    ] = (
        session.get(
            "customer_messages",
            0,
        )
        +
        session.get(
            "agent_messages",
            0,
        )
    )

    # Keep backwards compatibility.
    session[
        "message_count"
    ] = session[
        "total_messages"
    ]

    update_session(
        session_id,
        session,
    )

    return message


# ============================================================
# ADD AGENT MESSAGE
# ============================================================

def add_agent_message(
    session_id: str,
    text: str,
) -> Optional[dict]:
    """
    Store an AI agent response.
    """

    session = find_session(
        session_id
    )

    if not session:
        return None

    # ----------------------------------------
    # Message object
    # ----------------------------------------

    message = {
        "timestamp":
            datetime.now().isoformat(),

        "speaker":
            "agent",

        "text":
            text,

        "sentiment":
            None,

        "frustration":
            None,

        "frustration_score":
            None,

        "escalation_recommended":
            False,
    }

    # ----------------------------------------
    # Store message
    # ----------------------------------------

    session[
        "messages"
    ].append(message)

    # ----------------------------------------
    # Update message counters
    # ----------------------------------------

    session[
        "agent_messages"
    ] = (
        session.get(
            "agent_messages",
            0,
        ) + 1
    )

    session[
        "total_messages"
    ] = (
        session.get(
            "customer_messages",
            0,
        )
        +
        session.get(
            "agent_messages",
            0,
        )
    )

    # Keep backwards compatibility.
    session[
        "message_count"
    ] = session[
        "total_messages"
    ]

    update_session(
        session_id,
        session,
    )

    return message


# ============================================================
# RECORD TOOL USAGE
# ============================================================

def record_tool_usage(
    session_id: str,
    tool_name: str,
) -> Optional[dict]:
    """
    Record usage of a VoiceDesk AI tool.
    """

    session = find_session(
        session_id
    )

    if not session:
        return None

    tool_mapping = {
        "search_knowledge_base":
            "knowledge_search",

        "get_order_status":
            "order_status",

        "request_human_support":
            "human_escalation",
    }

    analytics_tool_name = (
        tool_mapping.get(
            tool_name
        )
    )

    # ----------------------------------------
    # Increment tool counter
    # ----------------------------------------

    if (
        analytics_tool_name
        and analytics_tool_name
        in session["tool_usage"]
    ):

        session[
            "tool_usage"
        ][analytics_tool_name] += 1

    # ----------------------------------------
    # Mark session as escalated
    # ----------------------------------------

    if (
        tool_name
        == "request_human_support"
    ):

        session[
            "escalated"
        ] = True

    update_session(
        session_id,
        session,
    )

    return session


# ============================================================
# RECORD ESCALATION
# ============================================================

def record_escalation(
    session_id: str,
    ticket_id: str,
) -> Optional[dict]:
    """
    Store the escalation ticket ID.

    IMPORTANT:
    The escalation count is NOT incremented here.
    record_tool_usage() already increments it.
    This prevents double counting.
    """

    session = find_session(
        session_id
    )

    if not session:
        return None

    session[
        "escalated"
    ] = True

    session[
        "escalation_ticket"
    ] = ticket_id

    update_session(
        session_id,
        session,
    )

    return session


# ============================================================
# END SESSION
# ============================================================

def end_session(
    session_id: str,
) -> Optional[dict]:
    """
    Mark a VoiceDesk session as completed.
    """

    session = find_session(
        session_id
    )

    if not session:
        return None

    session[
        "ended_at"
    ] = datetime.now().isoformat()

    update_session(
        session_id,
        session,
    )

    return session


# ============================================================
# GET ALL SESSIONS
# ============================================================

def get_sessions() -> list:
    """
    Return all stored analytics sessions.
    """

    data = load_analytics()

    return data.get(
        "sessions",
        [],
    )


# ============================================================
# ANALYTICS SUMMARY
# ============================================================

def get_analytics_summary() -> dict:
    """
    Generate dashboard-level analytics.
    """

    sessions = get_sessions()

    total_sessions = len(
        sessions
    )

    total_messages = 0

    positive = 0
    neutral = 0
    negative = 0

    low_frustration = 0
    medium_frustration = 0
    high_frustration = 0

    escalated_sessions = 0

    knowledge_searches = 0
    order_lookups = 0
    human_escalations = 0

    customer_messages = 0
    agent_messages = 0

    # ----------------------------------------
    # Conversation intelligence
    # ----------------------------------------

    intent_distribution = {}

    resolution = {
        "resolved": 0,
        "in_progress": 0,
        "escalated": 0,
        "unknown": 0,
    }

    order_related_sessions = 0

    # ----------------------------------------
    # Process sessions
    # ----------------------------------------

    for session in sessions:

        # ------------------------------------
        # Message statistics
        # ------------------------------------

        customer_messages += safe_int(
            session.get("customer_messages", 0)
        )

        agent_messages += safe_int(
            session.get("agent_messages", 0)
        )

        # Use actual stored messages
        # as source of truth.
        messages = session.get(
            "messages",
            [],
        )

        total_messages += (
            len(messages)
            if isinstance(messages, list)
            else safe_int(
                session.get(
                    "total_messages",
                    0,
                )
            )
        )

        # ------------------------------------
        # Conversation intelligence
        # ------------------------------------

        memory = session.get(
            "conversation_memory",
            {},
        )

        if not isinstance(memory, dict):
            memory = {}

        # ------------------------------------
        # Order-related conversation
        # ------------------------------------
        # Count a session as order-related when
        # order context exists in conversation memory
        # or the order-status tool was used.
        order_id = (
            memory.get("lastOrderId")
            or memory.get("last_order_id")
        )

        order_status = (
            memory.get("lastOrderStatus")
            or memory.get("last_order_status")
        )

        expected_delivery = (
            memory.get("expectedDelivery")
            or memory.get("expected_delivery")
        )

        session_tools = session.get(
            "tool_usage",
            {},
        )

        has_order_tool_usage = safe_int(
            session_tools.get(
                "order_status",
                0,
            )
        ) > 0

        has_order_memory = any(
            value not in (None, "", "unknown")
            for value in (
                order_id,
                order_status,
                expected_delivery,
            )
        )

        if has_order_tool_usage or has_order_memory:
            order_related_sessions += 1

        # Intent distribution
        intent = (
            memory.get("lastIntent")
            or memory.get("last_intent")
            or None
        )

        if isinstance(intent, str):
            intent = intent.strip().lower()

        if not intent:
            # Backward-compatible fallback based on tools.
            tools_for_intent = session.get(
                "tool_usage",
                {},
            )

            if tools_for_intent.get(
                "order_status",
                0,
            ) > 0:
                intent = "order_status"

            elif tools_for_intent.get(
                "knowledge_search",
                0,
            ) > 0:
                intent = "knowledge_search"

            elif tools_for_intent.get(
                "human_escalation",
                0,
            ) > 0:
                intent = "human_support"

            else:
                intent = "unknown"

        intent_distribution[intent] = (
            intent_distribution.get(
                intent,
                0,
            ) + 1
        )

               # ------------------------------------
        # Resolution state
        # ------------------------------------

        resolution_state = (
            memory.get("resolutionState")
            or memory.get("resolution_state")
            or None
        )

        if isinstance(resolution_state, str):
            resolution_state = (
                resolution_state.strip().lower()
            )

        # ------------------------------------
        # Resolution classification
        # ------------------------------------

        # Human escalation always takes priority.
        if session.get(
            "escalated",
            False,
        ):

            resolution["escalated"] += 1

        # Explicit resolution state from
        # conversation memory.
        elif resolution_state in {
            "resolved",
            "in_progress",
            "escalated",
            "unknown",
        }:

            resolution[resolution_state] += 1

        # Backward compatibility:
        # Older completed sessions may not have
        # conversation_memory.resolutionState.
        elif session.get("ended_at"):

            resolution["resolved"] += 1

        # Session is still active and has no
        # known resolution state.
        else:

            resolution["unknown"] += 1

        # ------------------------------------
        # Sentiment
        # ------------------------------------

        sentiment = session.get(
            "sentiment",
            {},
        )

        positive += sentiment.get(
            "positive",
            0,
        )

        neutral += sentiment.get(
            "neutral",
            0,
        )

        negative += sentiment.get(
            "negative",
            0,
        )

        # ------------------------------------
        # Frustration
        # ------------------------------------

        frustration = session.get(
            "frustration",
            {},
        )

        low_frustration += (
            frustration.get(
                "low",
                0,
            )
        )

        medium_frustration += (
            frustration.get(
                "medium",
                0,
            )
        )

        high_frustration += (
            frustration.get(
                "high",
                0,
            )
        )

        # ------------------------------------
        # Escalations
        # ------------------------------------

        if session.get(
            "escalated",
            False,
        ):

            escalated_sessions += 1

        # ------------------------------------
        # Tool usage
        # ------------------------------------

        tools = session.get(
            "tool_usage",
            {},
        )

        knowledge_searches += safe_int(
            tools.get(
                "knowledge_search",
                0,
            )
        )

        order_lookups += safe_int(
            tools.get(
                "order_status",
                0,
            )
        )

        human_escalations += safe_int(
            tools.get(
                "human_escalation",
                0,
            )
        )

    # ========================================================
    # CONVERSATION INTELLIGENCE METRICS
    # ========================================================

    resolved_sessions = resolution["resolved"]

    if total_sessions > 0:
        resolution_rate = round(
            resolved_sessions
            / total_sessions
            * 100,
            1,
        )

        average_messages_per_session = round(
            total_messages
            / total_sessions,
            1,
        )

        escalation_rate = round(
            escalated_sessions
            / total_sessions
            * 100,
            1,
        )

    else:
        resolution_rate = 0
        average_messages_per_session = 0
        escalation_rate = 0

    # ========================================================
    # SENTIMENT PERCENTAGES
    # ========================================================

    sentiment_total = (
        positive
        + neutral
        + negative
    )

    if sentiment_total > 0:

        positive_percentage = round(
            positive
            / sentiment_total
            * 100,
            1,
        )

        neutral_percentage = round(
            neutral
            / sentiment_total
            * 100,
            1,
        )

        negative_percentage = round(
            negative
            / sentiment_total
            * 100,
            1,
        )

    else:

        positive_percentage = 0
        neutral_percentage = 0
        negative_percentage = 0

    # ========================================================
    # RETURN SUMMARY
    # ========================================================

    return {
        "total_sessions":
            total_sessions,

        "total_messages":
            total_messages,

        "customer_messages":
            customer_messages,

        "agent_messages":
            agent_messages,

        # Conversation intelligence
        "intent_distribution":
            intent_distribution,

        "resolution":
            resolution,

        "resolved_sessions":
            resolved_sessions,

        "resolution_rate":
            resolution_rate,

        "average_messages_per_session":
            average_messages_per_session,

        "order_related_sessions":
            order_related_sessions,

        "escalation_rate":
            escalation_rate,

        # Nested object for clients that prefer a
        # single conversation-intelligence payload.
        "conversation_intelligence": {
            "intent_distribution":
                intent_distribution,

            "resolution":
                resolution,

            "resolved_sessions":
                resolved_sessions,

            "resolution_rate":
                resolution_rate,

            "average_messages_per_session":
                average_messages_per_session,

            "order_related_sessions":
                order_related_sessions,

            "escalation_rate":
                escalation_rate,
        },

        "sentiment": {
            "positive":
                positive,

            "neutral":
                neutral,

            "negative":
                negative,

            "positive_percentage":
                positive_percentage,

            "neutral_percentage":
                neutral_percentage,

            "negative_percentage":
                negative_percentage,
        },

        "frustration": {
            "low":
                low_frustration,

            "medium":
                medium_frustration,

            "high":
                high_frustration,
        },

        "escalations": {
            "sessions":
                escalated_sessions,

            "tickets":
                human_escalations,
        },

        "tool_usage": {
            "knowledge_search":
                knowledge_searches,

            "order_status":
                order_lookups,

            "human_escalation":
                human_escalations,
        },
    }


# ============================================================
# TEST
# ============================================================

if __name__ == "__main__":

    print("=" * 60)
    print("VoiceDesk AI - Analytics Storage Test")
    print("=" * 60)

    # --------------------------------------------------------
    # Create session
    # --------------------------------------------------------

    session = create_session()

    session_id = session[
        "session_id"
    ]

    print("\nCreated session:")
    print(session_id)

    # --------------------------------------------------------
    # Customer message 1
    # --------------------------------------------------------

    add_customer_message(
        session_id=session_id,
        text=(
            "Thank you, your support was great."
        ),
        sentiment_data={
            "sentiment":
                "positive",

            "frustration":
                "low",

            "frustration_score":
                0,

            "escalation_recommended":
                False,
        },
    )

    # --------------------------------------------------------
    # Customer message 2
    # --------------------------------------------------------

    add_customer_message(
        session_id=session_id,
        text=(
            "My order is delayed and "
            "this is frustrating."
        ),
        sentiment_data={
            "sentiment":
                "negative",

            "frustration":
                "medium",

            "frustration_score":
                65,

            "escalation_recommended":
                True,
        },
    )

    # --------------------------------------------------------
    # Agent response
    # --------------------------------------------------------

    add_agent_message(
        session_id=session_id,
        text=(
            "I understand your concern. "
            "Let me check your order."
        ),
    )

    # --------------------------------------------------------
    # Tool usage
    # --------------------------------------------------------

    record_tool_usage(
        session_id=session_id,
        tool_name="search_knowledge_base",
    )

    record_tool_usage(
        session_id=session_id,
        tool_name="get_order_status",
    )

    # --------------------------------------------------------
    # End session
    # --------------------------------------------------------

    end_session(
        session_id
    )

    # --------------------------------------------------------
    # Summary
    # --------------------------------------------------------

    summary = (
        get_analytics_summary()
    )

    print("\nAnalytics Summary:")

    print(
        json.dumps(
            summary,
            indent=2,
        )
    )

    print("\n" + "=" * 60)

    print(
        "Analytics storage test completed."
    )

    print("=" * 60)