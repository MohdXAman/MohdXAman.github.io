import { getToken } from './auth.js';

const DOMAIN = 'learn.reboot01.com';
const GRAPHQL_URL = `https://${DOMAIN}/api/graphql-engine/v1/graphql`;

export async function gqlQuery(queryString, variables = {}) {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query: queryString, variables }),
  });

  if (!res.ok) throw new Error(`HTTP error: ${res.status}`);

  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);

  return json.data;
}

// Normal query — basic user info + profile attrs
export const QUERY_USER = `
  {
    user {
      id
      login
      attrs
    }
  }
`;

// Normal query — XP transactions ordered by date
export const QUERY_XP = `
  {
    transaction(
      where: { type: { _eq: "xp" } }
      order_by: { createdAt: asc }
    ) {
      amount
      createdAt
      path
      objectId
    }
  }
`;

// Nested query — results with their associated objects
export const QUERY_RESULTS = `
  {
    result(
      where: { object: { type: { _eq: "project" } } }
      order_by: { createdAt: desc }
    ) {
      id
      grade
      createdAt
      path
      object {
        name
        type
      }
    }
  }
`;

// Nested query — audit stats from user table
export const QUERY_AUDITS = `
  {
    user {
      id
      login
      auditRatio
      totalUp
      totalDown
    }
  }
`;

// Query with argument — fetch a specific object by id
export const QUERY_OBJECT_BY_ID = `
  query GetObject($id: Int!) {
    object(where: { id: { _eq: $id } }) {
      id
      name
      type
    }
  }
`;
