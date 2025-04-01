import { formatCurrency } from '@/lib/utils';
import { Transaction, TransactionType } from '@/lib/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  ArrowDownIcon, 
  ArrowUpIcon, 
  ArrowLeftRightIcon, 
  CalendarIcon,
  InfoIcon
} from 'lucide-react';

interface TransactionCardProps {
  transaction: Transaction;
  onClick?: () => void;
}

export const TransactionCard = ({ transaction, onClick }: TransactionCardProps) => {
  const { type, amount, description, date, category } = transaction;

  // Déterminer l'icône et la couleur en fonction du type de transaction
  const getTypeIcon = () => {
    switch (type) {
      case TransactionType.INCOME:
        return <ArrowUpIcon className="h-5 w-5 text-green-500" />;
      case TransactionType.EXPENSE:
        return <ArrowDownIcon className="h-5 w-5 text-red-500" />;
      case TransactionType.TRANSFER:
        return <ArrowLeftRightIcon className="h-5 w-5 text-blue-500" />;
      default:
        return <InfoIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  // Déterminer la classe de couleur pour le montant
  const getAmountClass = () => {
    switch (type) {
      case TransactionType.INCOME:
        return 'text-green-600 font-semibold';
      case TransactionType.EXPENSE:
        return 'text-red-600 font-semibold';
      case TransactionType.TRANSFER:
        return 'text-blue-600 font-semibold';
      default:
        return 'text-gray-700 font-semibold';
    }
  };

  // Déterminer le préfixe du montant
  const getAmountPrefix = () => {
    switch (type) {
      case TransactionType.INCOME:
        return '+';
      case TransactionType.EXPENSE:
        return '-';
      default:
        return '';
    }
  };

  // Formater la date
  const formattedDate = format(new Date(date), 'dd MMMM yyyy', { locale: fr });

  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-3 mb-3 animate-fade-in-up"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-full p-2 mr-3">
            {getTypeIcon()}
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">{description}</h3>
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
              <CalendarIcon className="h-3 w-3 mr-1" />
              <span>{formattedDate}</span>
              {category && (
                <>
                  <span className="mx-1">•</span>
                  <span className="capitalize">{category.toLowerCase()}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className={getAmountClass()}>
          {getAmountPrefix()}{formatCurrency(amount)}
        </div>
      </div>
    </div>
  );
};

export default TransactionCard;
