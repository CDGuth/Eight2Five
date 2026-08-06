import { tva } from '@gluestack-ui/utils/nativewind-utils';
import { isWeb } from '@gluestack-ui/utils/nativewind-utils';

const captionTableStyle = isWeb ? 'caption-bottom' : '';

export const tableStyle = tva({
  base: `table border-collapse w-[800px]`,
});

export const tableHeaderStyle = tva({
  base: '',
});

export const tableBodyStyle = tva({
  base: '',
});

export const tableFooterStyle = tva({
  base: '',
});

export const tableHeadStyle = tva({
  base: 'flex-1 px-6 py-[14px] text-left font-body-bold text-[16px] leading-[22px] text-foreground/80',
});

export const tableRowStyleStyle = tva({
  base: 'border-0 border-b border-solid border-border/80 bg-background',
  variants: {
    isHeaderRow: {
      true: '',
    },
    isFooterRow: {
      true: 'border-b-0 ',
    },
  },
});

export const tableDataStyle = tva({
  base: 'flex-1 px-6 py-[14px] text-left text-[16px] font-body-medium leading-[22px] text-foreground/80',
});

export const tableCaptionStyle = tva({
  base: `${captionTableStyle} px-6 py-[14px] text-[16px] font-body leading-[22px] text-foreground/90 bg-background/90`,
});
