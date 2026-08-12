use rusqlite::{Connection, Result};
use std::path::Path;

const INITIAL_SCHEMA: &str = include_str!("../../migrations/0001_initial_schema.sql");

pub fn open_database(path: &Path) -> Result<Connection> {
    let connection = Connection::open(path)?;
    bootstrap_database(&connection)?;
    Ok(connection)
}

pub fn open_memory_database() -> Result<Connection> {
    let connection = Connection::open_in_memory()?;
    bootstrap_database(&connection)?;
    Ok(connection)
}

pub fn bootstrap_database(connection: &Connection) -> Result<()> {
    connection.execute_batch(INITIAL_SCHEMA)
}
