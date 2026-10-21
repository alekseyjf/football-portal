import { postFeedFilterWhere } from './post-feed-filter';

describe('postFeedFilterWhere', () => {
  it('без фільтрів — без умов: уся стрічка', () => {
    expect(postFeedFilterWhere({})).toEqual({});
  });

  it('усередині фільтра — «будь-який»: усі slug-и в одній умові', () => {
    expect(postFeedFilterWhere({ tags: 'transfers,injuries' })).toEqual({
      AND: [
        {
          tags: {
            some: { tag: { slug: { in: ['transfers', 'injuries'] } } },
          },
        },
      ],
    });
  });

  it('між фільтрами — «і»: кожен фільтр — окрема умова; турнір — прив’язка самої новини (D46)', () => {
    expect(
      postFeedFilterWhere({
        tags: 'transfers',
        competition: 'PL,CL',
        club: 'arsenal',
      }),
    ).toEqual({
      AND: [
        { tags: { some: { tag: { slug: { in: ['transfers'] } } } } },
        {
          competitions: {
            some: { competition: { slug: { in: ['PL', 'CL'] } } },
          },
        },
        { clubs: { some: { club: { slug: { in: ['arsenal'] } } } } },
      ],
    });
  });
});
