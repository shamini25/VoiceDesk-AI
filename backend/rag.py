import json
import math
import re
from pathlib import Path


KNOWLEDGE_BASE_PATH = (
    Path(__file__).parent
    / "knowledge_base"
    / "support_faq.json"
)


# Common words that don't help much with matching
STOP_WORDS = {
    "a",
    "an",
    "the",
    "is",
    "are",
    "am",
    "i",
    "me",
    "my",
    "to",
    "for",
    "of",
    "on",
    "in",
    "and",
    "or",
    "can",
    "do",
    "does",
    "how",
    "what",
    "when",
    "where",
    "will",
    "be",
    "it",
    "this",
    "that",
    "with",
    "should",
    "please",
}


# Related words used by customer-support queries
SYNONYMS = {
    "order": {"order", "purchase"},
    "package": {"package", "parcel", "shipment", "order"},
    "delivery": {
        "delivery",
        "deliver",
        "shipping",
        "shipment",
        "arrival",
    },
    "arrive": {
        "arrive",
        "arrival",
        "delivery",
        "deliver",
        "shipping",
    },
    "delayed": {
        "delayed",
        "delay",
        "late",
        "delayed",
    },
    "refund": {
        "refund",
        "refunded",
        "money",
        "reimbursement",
    },
    "return": {
        "return",
        "returns",
        "send",
        "back",
    },
    "payment": {
        "payment",
        "pay",
        "transaction",
        "charged",
    },
    "failed": {
        "failed",
        "failure",
        "declined",
        "rejected",
    },
    "password": {
        "password",
        "login",
        "signin",
        "sign",
        "account",
    },
    "warranty": {
        "warranty",
        "guarantee",
        "coverage",
    },
    "human": {
        "human",
        "agent",
        "representative",
        "person",
    },
}


def load_knowledge_base():
    """Load FAQs from the JSON knowledge base."""

    with open(
        KNOWLEDGE_BASE_PATH,
        "r",
        encoding="utf-8",
    ) as file:
        return json.load(file)


def tokenize(text):
    """Convert text into useful normalized words."""

    words = re.findall(
        r"\b[a-z0-9]+\b",
        text.lower(),
    )

    return {
        word
        for word in words
        if word not in STOP_WORDS
    }


def expand_words(words):
    """
    Expand important words with related terms.
    """

    expanded = set(words)

    for word in words:
        if word in SYNONYMS:
            expanded.update(
                SYNONYMS[word]
            )

    return expanded


def calculate_similarity(query, document):
    """
    Calculate a relevance score using:
    - keyword matching
    - related-word matching
    - category/question weighting
    """

    query_words = tokenize(query)
    query_words = expand_words(query_words)

    question_words = tokenize(
        document.get("question", "")
    )

    answer_words = tokenize(
        document.get("answer", "")
    )

    category_words = tokenize(
        document.get("category", "")
    )

    if not query_words:
        return 0.0

    # Question is more important than the answer
    question_matches = len(
        query_words.intersection(
            question_words
        )
    )

    answer_matches = len(
        query_words.intersection(
            answer_words
        )
    )

    category_matches = len(
        query_words.intersection(
            category_words
        )
    )

    score = (
        question_matches * 3.0
        + answer_matches * 1.0
        + category_matches * 2.0
    )

    # Normalize so scores remain manageable
    denominator = math.sqrt(
        len(query_words)
        * (
            len(question_words)
            + len(answer_words)
        )
    )

    if denominator == 0:
        return 0.0

    return score / denominator


def search_knowledge_base(
    query,
    top_k=3,
    minimum_score=0.10,
):
    """
    Search the FAQ knowledge base and return
    the most relevant results.
    """

    knowledge_base = load_knowledge_base()

    results = []

    for document in knowledge_base:
        score = calculate_similarity(
            query,
            document,
        )

        if score >= minimum_score:
            results.append(
                {
                    "score": round(score, 4),
                    "id": document.get("id"),
                    "category": document.get(
                        "category"
                    ),
                    "question": document.get(
                        "question"
                    ),
                    "answer": document.get(
                        "answer"
                    ),
                }
            )

    results.sort(
        key=lambda item: item["score"],
        reverse=True,
    )

    return results[:top_k]


def get_context(query):
    """
    Convert retrieved results into context
    that can later be provided to the AI agent.
    """

    results = search_knowledge_base(query)

    if not results:
        return ""

    context_parts = []

    for result in results:
        context_parts.append(
            f"Category: {result['category']}\n"
            f"Question: {result['question']}\n"
            f"Answer: {result['answer']}"
        )

    return "\n\n".join(context_parts)


if __name__ == "__main__":
    test_queries = [
        "How long will my order take to arrive?",
        "When will my package be delivered?",
        "My shipment is late",
        "How long does a refund take?",
        "I need to return my product",
        "My payment failed",
        "I forgot my password",
    ]

    print("\nVoiceDesk AI - RAG Search Test")
    print("=" * 50)

    for query in test_queries:
        print(f"\nCustomer: {query}")

        results = search_knowledge_base(
            query,
            top_k=1,
        )

        if not results:
            print("No relevant result found.")
            continue

        result = results[0]

        print(
            f"Score: {result['score']}"
        )
        print(
            f"Category: {result['category']}"
        )
        print(
            f"Matched FAQ: {result['question']}"
        )
        print(
            f"Answer: {result['answer']}"
        )