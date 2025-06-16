import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Fetch all evidence, ordered by netVotes descending
    try {
      const evidence = await prisma.evidence.findMany({
        orderBy: { netVotes: 'desc' }
      });
      res.status(200).json(evidence);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch evidence' });
    }
    return;
  }
  if (req.method === 'POST') {
    // Create new evidence
    const { type, title, url, description, walletAddress } = req.body;
    try {
      const evidence = await prisma.evidence.create({
        data: { type, title, url, description, walletAddress, netVotes: 0 },
      });
      res.status(201).json(evidence);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create evidence' });
    }
  } else if (req.method === 'PATCH') {
    // Update netVotes
    const { id, netVotes } = req.body;
    try {
      const evidence = await prisma.evidence.update({
        where: { id },
        data: { netVotes },
      });
      res.status(200).json(evidence);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update netVotes' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
