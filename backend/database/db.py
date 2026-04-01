from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, sessionmaker

from backend.config import settings


engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    future=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_database_exists() -> None:
    url = make_url(settings.database_url)
    if not url.database or not url.get_backend_name().startswith("mysql"):
        return

    admin_url = url.set(database=None)
    admin_engine = create_engine(admin_url, pool_pre_ping=True, future=True, isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as connection:
        connection.execute(
            text(
                f"CREATE DATABASE IF NOT EXISTS `{url.database}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
        )
    admin_engine.dispose()


def ensure_schema_compatibility() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("users"):
        return

    statements: list[str] = []

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "full_name" not in user_columns:
        statements.append("ALTER TABLE `users` ADD COLUMN `full_name` VARCHAR(120) NULL AFTER `username`")
    if "default_languages" not in user_columns:
        statements.append(
            "ALTER TABLE `users` ADD COLUMN `default_languages` LONGTEXT NOT NULL "
            "DEFAULT '[\"en-US\",\"hi-IN\"]' AFTER `bio`"
        )
    if "updated_at" not in user_columns:
        statements.append(
            "ALTER TABLE `users` ADD COLUMN `updated_at` DATETIME NOT NULL "
            "DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`"
        )

    conversation_columns = {column["name"] for column in inspector.get_columns("conversations")}
    if "title" not in conversation_columns:
        statements.append(
            "ALTER TABLE `conversations` ADD COLUMN `title` VARCHAR(180) NOT NULL "
            "DEFAULT 'New conversation' AFTER `user_id`"
        )
    if "last_message_at" not in conversation_columns:
        statements.append(
            "ALTER TABLE `conversations` ADD COLUMN `last_message_at` DATETIME NOT NULL "
            "DEFAULT CURRENT_TIMESTAMP AFTER `started_at`"
        )

    message_columns = {column["name"] for column in inspector.get_columns("messages")}
    if "language" not in message_columns:
        statements.append("ALTER TABLE `messages` ADD COLUMN `language` VARCHAR(20) NULL AFTER `message`")
    if "input_mode" not in message_columns:
        statements.append("ALTER TABLE `messages` ADD COLUMN `input_mode` VARCHAR(20) NULL AFTER `language`")
    sender_column = next((column for column in inspector.get_columns("messages") if column["name"] == "sender"), None)
    if sender_column and "enum" in str(sender_column["type"]).lower():
        statements.append("ALTER TABLE `messages` MODIFY COLUMN `sender` VARCHAR(20) NOT NULL")

    memory_columns = {column["name"] for column in inspector.get_columns("memory")}
    if "updated_at" not in memory_columns:
        statements.append(
            "ALTER TABLE `memory` ADD COLUMN `updated_at` DATETIME NOT NULL "
            "DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`"
        )

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))

        if "default_languages" not in user_columns:
            connection.execute(
                text(
                    "UPDATE `users` SET `default_languages`='[\"en-US\",\"hi-IN\"]' "
                    "WHERE `default_languages` IS NULL OR `default_languages` = ''"
                )
            )
        if "last_message_at" not in conversation_columns:
            connection.execute(
                text(
                    "UPDATE `conversations` SET `last_message_at` = `started_at` "
                    "WHERE `last_message_at` IS NULL"
                )
            )


def init_db() -> None:
    from backend.database import models  # noqa: F401

    ensure_database_exists()
    Base.metadata.create_all(bind=engine)
    ensure_schema_compatibility()
