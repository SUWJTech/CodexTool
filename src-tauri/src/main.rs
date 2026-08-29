// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if codextool_lib::try_run_cli_from_env() {
        return;
    }

    codextool_lib::run();
}
