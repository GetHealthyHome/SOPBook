import type { NextApiRequest, NextApiResponse } from 'next';

const HCP_BASE = 'https://api.housecallpro.com';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiKey = process.env.HOUSECALLPRO_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'HOUSECALLPRO_API_KEY not configured' });
  }

  const pathParts = req.query.path as string[];
  const endpoint = '/' + pathParts.join('/');

  const queryParams = { ...req.query };
  delete queryParams.path;
  const queryString = new URLSearchParams(queryParams as Record<string, string>).toString();
  const url = `${HCP_BASE}${endpoint}${queryString ? '?' + queryString : ''}`;

  try {
    const response = await fetch(url, {
      method: req.method,
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch from Housecall Pro' });
  }
}
