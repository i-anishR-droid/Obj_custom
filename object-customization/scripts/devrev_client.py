#!/usr/bin/env python3
"""DevRev API client — authenticated HTTP wrapper with pagination."""

import os
import json
import sys
from pathlib import Path
import requests
from dotenv import load_dotenv

plugin_root = Path(os.getenv('CLAUDE_PLUGIN_ROOT', Path(__file__).parent.parent))
load_dotenv(plugin_root / '.env')


class DevRevClient:
    def __init__(self):
        self.pat = os.getenv('DEVREV_PAT')
        self.endpoint = os.getenv('DEVREV_ENDPOINT', 'https://api.devrev.ai/internal')

        if not self.pat:
            env_file = plugin_root / '.env'
            if env_file.exists():
                load_dotenv(env_file)
                self.pat = os.getenv('DEVREV_PAT')
            if not self.pat:
                raise ValueError(
                    f"DEVREV_PAT not set.\n"
                    f"Please ensure DEVREV_PAT is set in {plugin_root}/.env"
                )

        self.headers = {
            'Authorization': self.pat,
            'Content-Type': 'application/json',
        }

    def post(self, api_path: str, payload: dict = None) -> dict:
        url = f"{self.endpoint}/{api_path}"
        try:
            response = requests.post(url, json=payload or {}, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError:
            error_details = ""
            try:
                data = response.json()
                error_details = data.get('message') or data.get('error') or data.get('detail') or json.dumps(data, indent=2)
            except Exception:
                error_details = response.text
            raise requests.exceptions.HTTPError(
                f"\n{'='*60}\nDevRev API Error\n{'='*60}\n"
                f"Endpoint: {url}\nStatus: {response.status_code}\nDetails: {error_details}\n{'='*60}",
                response=response,
            )

    def fetch_paginated(self, api_path: str, payload: dict, result_key: str = 'result') -> list:
        all_results = []
        cursor = None
        page = 0
        while True:
            req = payload.copy()
            if cursor:
                req['cursor'] = cursor
            resp = self.post(api_path, req)
            page += 1
            results = resp.get(result_key, [])
            if isinstance(results, list):
                all_results.extend(results)
            else:
                all_results.append(results)
            cursor = resp.get('cursor')
            if not cursor:
                break
        return all_results

    def get_schema(self, leaf_type: str, subtype: str, schema_type: str = 'custom_type_fragment') -> dict:
        results = self.fetch_paginated(
            'schemas.custom.list',
            {'leaf_type': [leaf_type], 'types': [schema_type], 'subtype': [subtype]},
        )
        return results[0] if results else None
