import Footer from '@/components/footer';
import Header from '@/components/header';
import StepIndicator from '@/components/stepIndicator';
import { StudySidebarPanel } from '@/components/StudySidebar';
import StudyUrlSync from '@/components/StudyUrlSync';
import { Suspense } from 'react';

export default async function Home() {
  return (
    <div className='flex h-dvh w-full overscroll-none'>
      <StudySidebarPanel />
      <main className='flex h-dvh min-w-0 flex-1 touch-none flex-col items-center overscroll-none select-none'>
        <Suspense fallback={null}>
          <StudyUrlSync />
        </Suspense>
        <Header />
        <StepIndicator />
        <Footer />
      </main>
    </div>
  );
}
