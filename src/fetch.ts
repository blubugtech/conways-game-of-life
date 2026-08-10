import { graphql } from "@octokit/graphql";

export interface ContributionDay {
  date: string;
  count: number;
  weekday: number;
}

export interface ContributionGrid {
  // weeks[weekIndex] → array of days actually present in that week (may be <7 for first/last week)
  weeks: ContributionDay[][];
  maxCount: number;
}

const QUERY = `
  query ($userName: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $userName) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              date
              weekday
            }
          }
        }
      }
    }
  }
`;

interface GraphQLResponse {
  user: {
    contributionsCollection: {
      contributionCalendar: {
        totalContributions: number;
        weeks: {
          contributionDays: {
            contributionCount: number;
            date: string;
            weekday: number;
          }[];
        }[];
      };
    };
  };
}

export async function fetchContributionGrid(
  userName: string,
  token: string,
): Promise<ContributionGrid> {
  const gql = graphql.defaults({
    headers: { authorization: `bearer ${token}` },
  });

  // Always fetch exactly the trailing 52 weeks (matching GitHub's profile UI)
  const to = new Date();
  const from = new Date(to);
  from.setFullYear(from.getFullYear() - 1);

  const res = await gql<GraphQLResponse>(QUERY, {
    userName,
    from: from.toISOString(),
    to: to.toISOString(),
  });

  const calendar = res.user.contributionsCollection.contributionCalendar;
  const rawWeeks = calendar.weeks;
  const totalContributions = calendar.totalContributions;

  let maxCount = 0;
  const weeks: ContributionDay[][] = rawWeeks.map((week) =>
    week.contributionDays.map((d) => {
      if (d.contributionCount > maxCount) maxCount = d.contributionCount;
      return {
        date: d.date,
        count: d.contributionCount,
        weekday: d.weekday,
      };
    }),
  );

  // If every day reported 0 (e.g. only private contributions), fall back to a
  // non-zero maxCount so weights are still meaningful (0.5 for all live cells).
  if (maxCount === 0 && totalContributions > 0) {
    maxCount = 1;
  }

  return { weeks, maxCount };
}
