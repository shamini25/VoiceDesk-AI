import os
import json

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from backend.rag import search_knowledge_base
from backend.orders import get_order_status
from backend.escalation import create_escalation
from backend.sentiment import analyze_sentiment
from backend.analytics import (
    create_session,
    get_analytics_summary,
    get_sessions,
    find_session,
    update_session,
    add_customer_message,
    add_agent_message,
    record_tool_usage,
    record_escalation,
    end_session,
)

# --------------------------------------------------
# ENVIRONMENT
# --------------------------------------------------

load_dotenv()

ASSEMBLYAI_API_KEY = os.getenv(
    "ASSEMBLYAI_API_KEY"
)


# --------------------------------------------------
# FASTAPI APP
# --------------------------------------------------

app = FastAPI(
    title="VoiceDesk AI API",
    description="Backend API for VoiceDesk AI",
    version="1.0.0",
)


# --------------------------------------------------
# CORS
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# ROOT
# --------------------------------------------------

@app.get("/")
async def root():
    return {
        "message":
            "VoiceDesk AI backend is running"
    }


# --------------------------------------------------
# ASSEMBLYAI TEMPORARY VOICE TOKEN
# --------------------------------------------------

@app.get("/api/voice-token")
async def voice_token():

    if not ASSEMBLYAI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail=(
                "ASSEMBLYAI_API_KEY "
                "is not configured."
            ),
        )

    url = (
        "https://agents.assemblyai.com/"
        "v1/token?expires_in_seconds=300"
    )

    headers = {
        "Authorization":
            f"Bearer {ASSEMBLYAI_API_KEY}"
    }

    try:
        async with httpx.AsyncClient(
            timeout=15
        ) as client:

            response = await client.get(
                url,
                headers=headers,
            )

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=(
                    "Unable to create "
                    "AssemblyAI voice token."
                ),
            )

        data = response.json()

        return {
            "token": data.get("token")
        }

    except httpx.RequestError as error:

        raise HTTPException(
            status_code=502,
            detail=(
                "Could not connect to "
                "AssemblyAI."
            ),
        ) from error


# --------------------------------------------------
# KNOWLEDGE BASE SEARCH
# --------------------------------------------------

@app.get("/api/knowledge-search")
async def knowledge_search(
    q: str = Query(
        ...,
        min_length=2,
        description="Customer question",
    )
):

    results = search_knowledge_base(
        query=q,
        top_k=3,
    )

    return {
        "query": q,
        "results": results,
    }


# --------------------------------------------------
# ORDER STATUS
# --------------------------------------------------

@app.get("/api/order-status")
async def order_status(
    order_id: str = Query(
        ...,
        min_length=3,
    )
):

    order = get_order_status(
        order_id
    )

    if not order:

        return {
            "success": False,
            "message":
                f"No order was found for "
                f"{order_id.upper()}.",
        }

    return {
        "success": True,
        "order": order,
    }


# --------------------------------------------------
# HUMAN ESCALATION
# --------------------------------------------------

@app.post("/api/escalate")
async def escalate_customer(
    reason: str = Query(
        "Customer requested human assistance"
    )
):

    return create_escalation(
        reason
    )


# --------------------------------------------------
# SENTIMENT ANALYSIS
# --------------------------------------------------

@app.get("/api/sentiment")
async def sentiment_analysis(
    text: str = Query(
        ...,
        min_length=2,
        description="Customer message",
    )
):

    return analyze_sentiment(
        text
    )


# --------------------------------------------------
# ANALYTICS SUMMARY
# --------------------------------------------------

@app.get("/api/analytics")
async def analytics():

    return get_analytics_summary()


# --------------------------------------------------
# ANALYTICS SESSIONS
# --------------------------------------------------

@app.get("/api/analytics/sessions")
async def analytics_sessions():

    return {
        "success": True,
        "sessions": get_sessions(),
    }

# --------------------------------------------------
# CREATE ANALYTICS SESSION
# --------------------------------------------------

@app.post("/api/analytics/session")
async def analytics_create_session():

    session = create_session()

    return {
        "success": True,
        "session": session,
    }


# --------------------------------------------------
# RECORD CUSTOMER MESSAGE
# --------------------------------------------------

@app.post("/api/analytics/customer-message")
async def analytics_customer_message(
    session_id: str = Query(...),
    text: str = Query(..., min_length=1),
    sentiment: str = Query("neutral"),
    frustration: str = Query("low"),
    frustration_score: int = Query(0),
    escalation_recommended: bool = Query(False),
):

    sentiment_data = {
        "sentiment": sentiment,
        "frustration": frustration,
        "frustration_score": frustration_score,
        "escalation_recommended":
            escalation_recommended,
    }

    message = add_customer_message(
        session_id=session_id,
        text=text,
        sentiment_data=sentiment_data,
    )

    if not message:
        raise HTTPException(
            status_code=404,
            detail="Analytics session not found.",
        )

    return {
        "success": True,
        "message": message,
    }


# --------------------------------------------------
# RECORD AGENT MESSAGE
# --------------------------------------------------

@app.post("/api/analytics/agent-message")
async def analytics_agent_message(
    session_id: str = Query(...),
    text: str = Query(..., min_length=1),
):

    message = add_agent_message(
        session_id=session_id,
        text=text,
    )

    if not message:
        raise HTTPException(
            status_code=404,
            detail="Analytics session not found.",
        )

    return {
        "success": True,
        "message": message,
    }


# --------------------------------------------------
# RECORD TOOL USAGE
# --------------------------------------------------

@app.post("/api/analytics/tool")
async def analytics_tool(
    session_id: str = Query(...),
    tool_name: str = Query(...),
):

    session = record_tool_usage(
        session_id=session_id,
        tool_name=tool_name,
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Analytics session not found.",
        )

    return {
        "success": True,
        "session": session,
    }


# --------------------------------------------------
# END ANALYTICS SESSION
# --------------------------------------------------

@app.post("/api/analytics/session/end")
async def analytics_end_session(
    session_id: str = Query(...),
):

    session = end_session(
        session_id
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Analytics session not found.",
        )

    return {
        "success": True,
        "session": session,
    }

@app.get("/api/analytics/session/{session_id}")
async def analytics_session(
    session_id: str
):
    session = find_session(session_id)

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Analytics session not found."
        )

    return {
        "success": True,
        "session": session
    }

# --------------------------------------------------
# RECORD HUMAN ESCALATION
# --------------------------------------------------

@app.post("/api/analytics/escalation")
async def analytics_escalation(
    session_id: str = Query(...),
    ticket_id: str = Query(...),
):
    session = record_escalation(
        session_id=session_id,
        ticket_id=ticket_id,
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Analytics session not found.",
        )

    return {
        "success": True,
        "session": session,
    }

@app.get("/api/analytics/session/{session_id}/summary")
async def analytics_session_summary(session_id: str):
    session = find_session(session_id)

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Analytics session not found."
        )

    messages = session.get("messages", [])

    customer_messages = [
        message
        for message in messages
        if message.get("role") == "customer"
        or message.get("speaker") == "customer"
    ]

    agent_messages = [
        message
        for message in messages
        if message.get("role") == "agent"
        or message.get("speaker") == "agent"
    ]

    memory = session.get(
        "conversation_memory",
        {}
    )

    order_id = memory.get("lastOrderId")
    order_status = memory.get("lastOrderStatus")
    expected_delivery = memory.get(
        "expectedDelivery"
    )
    current_issue = memory.get(
        "currentIssue"
    )
    last_intent = memory.get(
        "lastIntent"
    )

    # If an order was successfully identified but the frontend
    # stored a generic intent, the conversation is still an
    # order-status conversation. Keep the analytics summary
    # consistent with the actual tool activity and order context.
    if (
        order_id
        and (
            not last_intent
            or last_intent in {
                "general_query",
                "unknown",
            }
        )
    ):
        last_intent = "order_status"

    resolution_state = memory.get(
        "resolutionState",
        memory.get(
            "resolution_state",
            "unknown"
        )
    )

    if isinstance(resolution_state, str):
        resolution_state = resolution_state.strip().lower()

    if session.get("escalated", False):
        resolution_state = "escalated"
    elif resolution_state not in {
        "resolved",
        "in_progress",
        "escalated",
        "unknown",
    }:
        resolution_state = "unknown"

    # -----------------------------------------------
    # INTELLIGENT RESOLUTION DETECTION
    # -----------------------------------------------

    customer_text_lower = [
        str(message.get("text", "")).strip().lower()
        for message in customer_messages
        if str(message.get("text", "")).strip()
    ]

    positive_closure_phrases = {
        "okay",
        "ok",
        "okay.",
        "ok.",
        "thanks",
        "thanks.",
        "thank you",
        "thank you.",
        "that's all",
        "that's all.",
        "nothing else",
        "nothing else.",
        "no",
        "no.",
    }

    customer_acknowledged = any(
        text in positive_closure_phrases
        for text in customer_text_lower
    )

    session_tool_usage = session.get(
        "tool_usage",
        {}
    )

    order_status_checked = (
        session_tool_usage.get(
            "order_status",
            0
        ) > 0
    )

    knowledge_answered = (
        session_tool_usage.get(
            "knowledge_search",
            0
        ) > 0
    )

    if (
        not session.get("escalated", False)
        and customer_acknowledged
        and (
            order_status_checked
            or knowledge_answered
        )
    ):
        resolution_state = "resolved"

    sentiment = session.get(
        "sentiment",
        {}
    )

    frustration = session.get(
        "frustration",
        {}
    )

    # -----------------------------------------------
    # OVERALL SENTIMENT
    # -----------------------------------------------

    if sentiment.get("negative", 0) > (
        sentiment.get("positive", 0)
    ):
        overall_sentiment = "Negative"
    elif sentiment.get("positive", 0) > (
        sentiment.get("negative", 0)
    ):
        overall_sentiment = "Positive"
    else:
        overall_sentiment = "Neutral"

    # -----------------------------------------------
    # FRUSTRATION
    # -----------------------------------------------

    if frustration.get("high", 0) > 0:
        frustration_level = "High"
    elif frustration.get("medium", 0) > 0:
        frustration_level = "Medium"
    else:
        frustration_level = "Low"

    # -----------------------------------------------
    # CUSTOMER ISSUE
    # -----------------------------------------------

    # Use the first meaningful customer message as the
    # primary issue instead of the last message. This
    # prevents short closing replies such as "No" or
    # "Okay, thank you" from replacing the actual issue.
    customer_texts = [
        str(message.get("text", "")).strip()
        for message in customer_messages
        if str(message.get("text", "")).strip()
    ]

    closing_messages = {
        "no",
        "no.",
        "okay",
        "okay.",
        "ok",
        "ok.",
        "thanks",
        "thanks.",
        "thank you",
        "thank you.",
        "thankyou",
        "thankyou.",
        "nothing else",
        "nothing else.",
    }

    meaningful_customer_texts = [
        text
        for text in customer_texts
        if text.lower() not in closing_messages
    ]

    first_customer_message = (
        meaningful_customer_texts[0]
        if meaningful_customer_texts
        else ""
    )

    if last_intent == "order_status" and order_id:
        customer_issue = (
            f"Customer asked for the status of order {order_id}."
        )
    elif last_intent == "order_status":
        customer_issue = (
            "Customer asked for an order status update."
        )
    elif last_intent == "knowledge_search":
        if first_customer_message:
            customer_issue = first_customer_message
        else:
            customer_issue = (
                "Customer requested information from the "
                "support knowledge base."
            )
    elif first_customer_message:
        customer_issue = first_customer_message
    elif current_issue:
        customer_issue = current_issue
    elif last_intent:
        customer_issue = last_intent
    else:
        customer_issue = (
            "General customer support request"
        )

    # -----------------------------------------------
    # ACTIONS TAKEN
    # -----------------------------------------------

    actions = []

    tool_usage = session.get(
        "tool_usage",
        {}
    )

    if tool_usage.get(
        "knowledge_search",
        0
    ) > 0:
        actions.append(
            "Knowledge base information was retrieved"
        )

    if tool_usage.get(
        "order_status",
        0
    ) > 0:
        actions.append(
            "Order status was checked"
        )

    if session.get("escalated"):
        actions.append(
            "Customer was escalated to human support"
        )

    if not actions:
        actions.append(
            "Customer conversation was analyzed"
        )

    # -----------------------------------------------
    # OUTCOME
    # -----------------------------------------------

    if resolution_state == "escalated":
        outcome = (
            "Escalated to Human Support"
        )
    elif resolution_state == "resolved":
        outcome = "Resolved"
    elif resolution_state == "in_progress":
        outcome = "In Progress"
    else:
        outcome = "Not Determined"

    # -----------------------------------------------
    # FOLLOW-UP
    # -----------------------------------------------

    if session.get("escalated"):
        follow_up = (
            "Human support should review the "
            "customer's request and continue assistance."
        )
    elif resolution_state == "resolved":
        follow_up = (
            "No additional action is required unless "
            "the customer requests further assistance."
        )
    elif (
        frustration_level == "High"
        or frustration_level == "Medium"
    ):
        follow_up = (
            "Follow up with the customer to confirm "
            "that the issue has been resolved."
        )
    elif order_id:
        follow_up = (
            "Provide updated delivery information "
            "if the customer requests another order update."
        )
    else:
        follow_up = (
            "No additional follow-up was identified."
        )

    # -----------------------------------------------
    # CONVERSATION HIGHLIGHTS
    # -----------------------------------------------

    customer_conversation = [
        message.get("text", "")
        for message in customer_messages
        if message.get("text")
    ]

    highlights = customer_conversation[-5:]

    # -----------------------------------------------
    # SUMMARY
    # -----------------------------------------------

    summary = {
        "session_id": session_id,

        "customer_issue": customer_issue,

        "intent": last_intent,

        "order": {
            "order_id": order_id,
            "status": order_status,
            "expected_delivery": expected_delivery,
        },

        "conversation": {
            "customer_messages": len(
                customer_messages
            ),
            "agent_messages": len(
                agent_messages
            ),
            "total_messages": len(
                messages
            ),
        },

        "sentiment": {
            "overall": overall_sentiment,
            "positive": sentiment.get(
                "positive",
                0
            ),
            "neutral": sentiment.get(
                "neutral",
                0
            ),
            "negative": sentiment.get(
                "negative",
                0
            ),
        },

        "frustration": {
            "level": frustration_level,
            "low": frustration.get(
                "low",
                0
            ),
            "medium": frustration.get(
                "medium",
                0
            ),
            "high": frustration.get(
                "high",
                0
            ),
        },

        "resolution": {
            "state": resolution_state,
            "outcome": outcome,
            "escalated": session.get(
                "escalated",
                False
            ),
            "ticket": session.get(
                "escalation_ticket"
            ),
        },

        "actions": actions,

        "follow_up": follow_up,

        "highlights": highlights,

        "customer_conversation":
            " ".join(
                customer_conversation
            ),
    }

    return {
        "success": True,
        "summary": summary,
    }

@app.post("/api/analytics/session/memory")
async def analytics_session_memory(payload: dict):
    """Save conversation memory for an analytics session."""

    try:
        session_id = payload.get("session_id")
        memory_data = payload.get("memory")

        if not session_id:
            raise HTTPException(
                status_code=400,
                detail="session_id is required",
            )

        # Support both a dictionary and a JSON string for memory.
        if isinstance(memory_data, str):
            try:
                memory_data = json.loads(memory_data)
            except json.JSONDecodeError as error:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid memory JSON",
                ) from error

        if not isinstance(memory_data, dict):
            raise HTTPException(
                status_code=400,
                detail="memory must be an object",
            )

        session = find_session(session_id)

        if not session:
            raise HTTPException(
                status_code=404,
                detail="Analytics session not found",
            )

        session["conversation_memory"] = memory_data

        updated_session = update_session(
            session_id,
            session,
        )

        if not updated_session:
            raise HTTPException(
                status_code=404,
                detail="Analytics session could not be updated",
            )

        print(
            f"Conversation memory saved successfully: {session_id}"
        )

        return {
            "success": True,
            "session_id": session_id,
            "conversation_memory": memory_data,
        }

    except HTTPException:
        raise

    except Exception as error:
        print(
            f"Conversation memory save error: {error}"
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to save conversation memory",
        ) from error
