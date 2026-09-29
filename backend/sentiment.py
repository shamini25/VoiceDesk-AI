import re


# --------------------------------------------------
# POSITIVE WORDS
# --------------------------------------------------

POSITIVE_WORDS = {
    "good",
    "great",
    "excellent",
    "awesome",
    "amazing",
    "happy",
    "helpful",
    "thanks",
    "thank",
    "perfect",
    "love",
    "satisfied",
    "resolved",
    "resolve",
    "solved",
    "solve",
    "appreciate",
    "quick",
    "quickly",
    "easy",
    "wonderful",
    "fantastic",
    "smooth",
    "convenient",
}


# --------------------------------------------------
# NEGATIVE EMOTION WORDS
# --------------------------------------------------

NEGATIVE_EMOTION_WORDS = {
    "bad",
    "poor",
    "slow",
    "late",
    "wrong",
    "failed",
    "failure",
    "broken",
    "missing",
    "disappointed",
    "unhappy",
    "difficult",
    "error",
    "stuck",
    "lost",
    "unacceptable",
    "terrible",
    "ridiculous",
    "awful",
    "horrible",
}


# --------------------------------------------------
# PROBLEM / SUPPORT WORDS
#
# These describe an issue but do NOT automatically
# mean the customer is negative.
# --------------------------------------------------

PROBLEM_WORDS = {
    "problem",
    "issue",
    "refund",
    "complaint",
    "delay",
    "delayed",
    "waiting",
    "wait",
}


# --------------------------------------------------
# FRUSTRATION WORDS
# --------------------------------------------------

FRUSTRATION_WORDS = {
    "angry",
    "ridiculous",
    "terrible",
    "worst",
    "unacceptable",
    "annoying",
    "annoyed",
    "frustrated",
    "frustrating",
    "furious",
    "useless",
    "hate",
    "again",
    "still",
    "never",
    "immediately",
    "disappointed",
    "fed",
    "enough",
    "seriously",
    "crazy",
    "absurd",
}


# --------------------------------------------------
# DELAY WORDS
# --------------------------------------------------

DELAY_WORDS = {
    "waiting",
    "wait",
    "weeks",
    "week",
    "days",
    "day",
    "late",
    "delay",
    "delayed",
    "still",
}


# --------------------------------------------------
# TOKENIZATION
# --------------------------------------------------

def tokenize(text: str) -> list[str]:
    """
    Convert text into lowercase words.
    """

    return re.findall(
        r"\b[a-zA-Z]+\b",
        text.lower(),
    )


# --------------------------------------------------
# SENTIMENT ANALYSIS
# --------------------------------------------------

def analyze_sentiment(text: str) -> dict:
    """
    Analyze customer sentiment and frustration.
    """

    clean_text = text.strip()

    if not clean_text:
        return {
            "success": False,
            "text": "",
            "sentiment": "neutral",
            "sentiment_score": 0,
            "frustration": "low",
            "frustration_score": 0,
            "escalation_recommended": False,
            "signals": {
                "positive_words": 0,
                "negative_words": 0,
                "problem_words": 0,
                "frustration_words": 0,
                "delay_words": 0,
                "exclamations": 0,
                "questions": 0,
            },
        }

    words = tokenize(clean_text)

    # --------------------------------------------------
    # COUNT SIGNALS
    # --------------------------------------------------

    positive_count = sum(
        1
        for word in words
        if word in POSITIVE_WORDS
    )

    negative_count = sum(
        1
        for word in words
        if word in NEGATIVE_EMOTION_WORDS
    )

    problem_count = sum(
        1
        for word in words
        if word in PROBLEM_WORDS
    )

    frustration_count = sum(
        1
        for word in words
        if word in FRUSTRATION_WORDS
    )

    delay_count = sum(
        1
        for word in words
        if word in DELAY_WORDS
    )

    exclamation_count = clean_text.count("!")
    question_count = clean_text.count("?")

    # --------------------------------------------------
    # SENTIMENT SCORE
    # --------------------------------------------------

    sentiment_score = (
        positive_count * 2
        - negative_count * 2
        - frustration_count
    )

    # --------------------------------------------------
    # POSITIVE CONTEXT
    #
    # Problem words alone do not make a customer
    # negative.
    #
    # Example:
    # "Thanks for solving my issue quickly."
    # --------------------------------------------------

    positive_context = (
        positive_count >= 1
        and frustration_count == 0
        and negative_count == 0
    )

    # Strong positive expression.
    if positive_context:
        sentiment = "positive"

    # Clear negative emotion.
    elif (
        negative_count >= 1
        or frustration_count >= 1
    ):
        sentiment = "negative"

    # No emotional signal.
    else:
        sentiment = "neutral"

    # --------------------------------------------------
    # SPECIAL CASE:
    # "Thanks for solving my issue"
    #
    # The word "issue" should not overpower
    # positive language.
    # --------------------------------------------------

    if (
        positive_count >= 1
        and frustration_count == 0
        and negative_count == 0
    ):
        sentiment = "positive"

    # --------------------------------------------------
    # FRUSTRATION SCORE
    # --------------------------------------------------

    frustration_score = 0

    # Strong frustration words.
    frustration_score += (
        frustration_count * 25
    )

    # Negative emotional words.
    frustration_score += (
        negative_count * 15
    )

    # Delays and waiting.
    frustration_score += (
        delay_count * 10
    )

    # Exclamation marks.
    frustration_score += min(
        exclamation_count * 10,
        20,
    )

    # Multiple questions can indicate urgency.
    if question_count >= 2:
        frustration_score += 10

    # --------------------------------------------------
    # COMBINATION SIGNALS
    # --------------------------------------------------

    # Delayed + frustrated.
    if (
        delay_count >= 1
        and frustration_count >= 1
    ):
        frustration_score += 20

    # Waiting for weeks.
    if (
        "waiting" in words
        and (
            "week" in words
            or "weeks" in words
        )
    ):
        frustration_score += 20

    # Still waiting.
    if (
        "still" in words
        and (
            "waiting" in words
            or "wait" in words
        )
    ):
        frustration_score += 20

    # Repeated-problem language.
    repeated_signal_words = sum(
        1
        for word in words
        if word in {
            "still",
            "again",
            "never",
        }
    )

    frustration_score += (
        repeated_signal_words * 10
    )

    # Keep score between 0 and 100.
    frustration_score = min(
        frustration_score,
        100,
    )

    # --------------------------------------------------
    # FRUSTRATION LEVEL
    # --------------------------------------------------

    if frustration_score >= 70:
        frustration = "high"

    elif frustration_score >= 35:
        frustration = "medium"

    else:
        frustration = "low"

    # --------------------------------------------------
    # ESCALATION
    # --------------------------------------------------

    escalation_recommended = False

    if frustration == "high":
        escalation_recommended = True

    elif (
        sentiment == "negative"
        and (
            frustration_count >= 2
            or negative_count >= 3
        )
    ):
        escalation_recommended = True

    elif (
        delay_count >= 2
        and frustration_count >= 1
    ):
        escalation_recommended = True

    # --------------------------------------------------
    # RESULT
    # --------------------------------------------------

    return {
        "success": True,
        "text": clean_text,
        "sentiment": sentiment,
        "sentiment_score": sentiment_score,
        "frustration": frustration,
        "frustration_score": frustration_score,
        "escalation_recommended":
            escalation_recommended,
        "signals": {
            "positive_words":
                positive_count,
            "negative_words":
                negative_count,
            "problem_words":
                problem_count,
            "frustration_words":
                frustration_count,
            "delay_words":
                delay_count,
            "exclamations":
                exclamation_count,
            "questions":
                question_count,
        },
    }


# --------------------------------------------------
# TEST CASES
# --------------------------------------------------

if __name__ == "__main__":

    test_messages = [
        "Thank you, your support was great!",

        "Where is my order?",

        "My order is delayed and this is frustrating.",

        "This is ridiculous! I have been waiting for two weeks!",

        "Everything is perfect, thank you.",

        "I am very angry. My order is still delayed!",

        "This problem is unacceptable and I am frustrated.",

        "Thanks for solving my issue quickly.",
    ]

    print("=" * 60)
    print("VoiceDesk AI - Sentiment Analysis Test")
    print("=" * 60)

    for message in test_messages:

        print("\nCustomer:")
        print(message)

        result = analyze_sentiment(
            message
        )

        print("\nAnalysis:")

        print(
            f"Sentiment: "
            f"{result['sentiment']}"
        )

        print(
            f"Sentiment Score: "
            f"{result['sentiment_score']}"
        )

        print(
            f"Frustration: "
            f"{result['frustration']}"
        )

        print(
            f"Frustration Score: "
            f"{result['frustration_score']}"
        )

        print(
            f"Escalation Recommended: "
            f"{result['escalation_recommended']}"
        )

        print(
            f"Signals: "
            f"{result['signals']}"
        )

    print("\n" + "=" * 60)
    print("Sentiment test completed.")
    print("=" * 60)