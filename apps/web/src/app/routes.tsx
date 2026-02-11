import { createBrowserRouter } from 'react-router';
import { RootLayout } from './pages/RootLayout';
import { LearningInterface } from './pages/LearningInterface';
import { TextbookPage } from './pages/TextbookPage';
import { ResearchPage } from './pages/ResearchPage';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      {
        index: true,
        Component: LearningInterface,
      },
      {
        path: 'textbook',
        Component: TextbookPage,
      },
      {
        path: 'research',
        Component: ResearchPage,
      },
    ],
  },
]);
